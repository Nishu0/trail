package relay

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	dbtypes "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/aws/aws-sdk-go-v2/service/dynamodbstreams"
	"github.com/aws/aws-sdk-go-v2/service/dynamodbstreams/types"

	"trail/pipeline/internal/events"
)

// Streams is the dynamodb streams client subset the relay uses.
type Streams interface {
	DescribeStream(context.Context, *dynamodbstreams.DescribeStreamInput, ...func(*dynamodbstreams.Options)) (*dynamodbstreams.DescribeStreamOutput, error)
	GetShardIterator(context.Context, *dynamodbstreams.GetShardIteratorInput, ...func(*dynamodbstreams.Options)) (*dynamodbstreams.GetShardIteratorOutput, error)
	GetRecords(context.Context, *dynamodbstreams.GetRecordsInput, ...func(*dynamodbstreams.Options)) (*dynamodbstreams.GetRecordsOutput, error)
}

// Checkpoints is the dynamodb subset used to remember the last record read.
type Checkpoints interface {
	CreateTable(context.Context, *dynamodb.CreateTableInput, ...func(*dynamodb.Options)) (*dynamodb.CreateTableOutput, error)
	GetItem(context.Context, *dynamodb.GetItemInput, ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error)
	PutItem(context.Context, *dynamodb.PutItemInput, ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error)
}

type Relay struct {
	Streams   Streams
	DB        Checkpoints
	StreamARN string
	Table     string // checkpoint table, separate so its writes do not feed the stream
	Pub       events.Publisher
	Log       *slog.Logger
	Poll      time.Duration
	iterators map[string]*string // open shard iterators, reused between polls
	finished  map[string]bool    // closed shards fully read
}

// EnsureCheckpointTable creates the checkpoint table if missing.
func (r *Relay) EnsureCheckpointTable(ctx context.Context) error {
	_, err := r.DB.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName:   &r.Table,
		BillingMode: dbtypes.BillingModePayPerRequest,
		AttributeDefinitions: []dbtypes.AttributeDefinition{
			{AttributeName: aws.String("shard"), AttributeType: dbtypes.ScalarAttributeTypeS},
		},
		KeySchema: []dbtypes.KeySchemaElement{{AttributeName: aws.String("shard"), KeyType: dbtypes.KeyTypeHash}},
	})
	var inUse *dbtypes.ResourceInUseException
	if errors.As(err, &inUse) {
		return nil
	}
	return err
}

// Run polls the stream until ctx is cancelled.
func (r *Relay) Run(ctx context.Context) error {
	r.iterators, r.finished = map[string]*string{}, map[string]bool{}
	if r.Poll == 0 {
		r.Poll = time.Second
	}
	r.Log.Info("relaying", "stream", r.StreamARN)
	for {
		if err := r.pass(ctx); err != nil && ctx.Err() == nil {
			// nothing was checkpointed past the failure, so the next pass resumes there.
			r.Log.Error("relay pass failed, retrying", "err", err)
		}
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(r.Poll):
		}
	}
}

// pass reads every shard once. a shard is read only after its parent is done,
// which keeps the changes to one item in order across shard splits.
func (r *Relay) pass(ctx context.Context) error {
	shards, err := r.shards(ctx)
	if err != nil {
		return err
	}
	open := map[string]bool{}
	for _, s := range shards {
		open[aws.ToString(s.ShardId)] = !r.finished[aws.ToString(s.ShardId)]
	}
	for _, s := range shards {
		id := aws.ToString(s.ShardId)
		if r.finished[id] || open[aws.ToString(s.ParentShardId)] {
			continue
		}
		if err := r.drain(ctx, id); err != nil {
			delete(r.iterators, id) // resume from the checkpoint next time
			return fmt.Errorf("shard %s: %w", id, err)
		}
	}
	return nil
}

func (r *Relay) shards(ctx context.Context) ([]types.Shard, error) {
	var all []types.Shard
	var start *string
	for {
		out, err := r.Streams.DescribeStream(ctx, &dynamodbstreams.DescribeStreamInput{
			StreamArn: &r.StreamARN, ExclusiveStartShardId: start,
		})
		if err != nil {
			return nil, err
		}
		all = append(all, out.StreamDescription.Shards...)
		start = out.StreamDescription.LastEvaluatedShardId
		if start == nil {
			return all, nil
		}
	}
}

// drain reads a shard until it has no new records. publish first, checkpoint
// second: a crash in between republishes (at-least-once), never loses.
func (r *Relay) drain(ctx context.Context, shard string) error {
	it, err := r.iterator(ctx, shard)
	if err != nil {
		return err
	}
	for it != nil {
		out, err := r.Streams.GetRecords(ctx, &dynamodbstreams.GetRecordsInput{ShardIterator: it, Limit: aws.Int32(100)})
		var expired *types.ExpiredIteratorException
		if errors.As(err, &expired) {
			delete(r.iterators, shard)
			return nil // iterators live 15 minutes; get a fresh one next pass
		}
		if err != nil {
			return err
		}
		var batch []events.Event
		for _, rec := range out.Records {
			evs, err := Convert(rec)
			if err != nil {
				return err
			}
			batch = append(batch, evs...)
		}
		if len(batch) > 0 {
			if err := r.Pub.Publish(ctx, batch...); err != nil {
				return err
			}
			for _, e := range batch {
				r.Log.Info("relayed", "type", e.Type, "job", e.JobID, "id", e.ID)
			}
		}
		if n := len(out.Records); n > 0 {
			if err := r.save(ctx, shard, aws.ToString(out.Records[n-1].Dynamodb.SequenceNumber)); err != nil {
				return err
			}
		}
		it = out.NextShardIterator
		r.iterators[shard] = it
		if it == nil {
			r.finished[shard] = true // shard closed and fully read
			return nil
		}
		if len(out.Records) == 0 {
			return nil // caught up; poll again later
		}
	}
	return nil
}

// iterator resumes after the saved sequence number, or starts at the oldest
// record still in the stream (24h retention) the first time.
func (r *Relay) iterator(ctx context.Context, shard string) (*string, error) {
	if it, ok := r.iterators[shard]; ok && it != nil {
		return it, nil
	}
	in := &dynamodbstreams.GetShardIteratorInput{StreamArn: &r.StreamARN, ShardId: &shard, ShardIteratorType: types.ShardIteratorTypeTrimHorizon}
	if seq, err := r.load(ctx, shard); err != nil {
		return nil, err
	} else if seq != "" {
		in.ShardIteratorType, in.SequenceNumber = types.ShardIteratorTypeAfterSequenceNumber, &seq
	}
	out, err := r.Streams.GetShardIterator(ctx, in)
	if err != nil {
		return nil, err
	}
	return out.ShardIterator, nil
}

func (r *Relay) load(ctx context.Context, shard string) (string, error) {
	out, err := r.DB.GetItem(ctx, &dynamodb.GetItemInput{
		TableName: &r.Table,
		Key:       map[string]dbtypes.AttributeValue{"shard": &dbtypes.AttributeValueMemberS{Value: shard}},
	})
	if err != nil {
		return "", err
	}
	if v, ok := out.Item["seq"].(*dbtypes.AttributeValueMemberS); ok {
		return v.Value, nil
	}
	return "", nil
}

func (r *Relay) save(ctx context.Context, shard, seq string) error {
	_, err := r.DB.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &r.Table,
		Item: map[string]dbtypes.AttributeValue{
			"shard": &dbtypes.AttributeValueMemberS{Value: shard},
			"seq":   &dbtypes.AttributeValueMemberS{Value: seq},
			"at":    &dbtypes.AttributeValueMemberS{Value: time.Now().UTC().Format(time.RFC3339)},
		},
	})
	return err
}
