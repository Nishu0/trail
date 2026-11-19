package store

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/expression"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"trail/pipeline/internal/pipeline"
)

// API is the dynamodb client subset the store uses, so tests can swap it.
type API interface {
	CreateTable(context.Context, *dynamodb.CreateTableInput, ...func(*dynamodb.Options)) (*dynamodb.CreateTableOutput, error)
	DescribeTable(context.Context, *dynamodb.DescribeTableInput, ...func(*dynamodb.Options)) (*dynamodb.DescribeTableOutput, error)
	DeleteTable(context.Context, *dynamodb.DeleteTableInput, ...func(*dynamodb.Options)) (*dynamodb.DeleteTableOutput, error)
	UpdateTable(context.Context, *dynamodb.UpdateTableInput, ...func(*dynamodb.Options)) (*dynamodb.UpdateTableOutput, error)
	GetItem(context.Context, *dynamodb.GetItemInput, ...func(*dynamodb.Options)) (*dynamodb.GetItemOutput, error)
	PutItem(context.Context, *dynamodb.PutItemInput, ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error)
	UpdateItem(context.Context, *dynamodb.UpdateItemInput, ...func(*dynamodb.Options)) (*dynamodb.UpdateItemOutput, error)
	Query(context.Context, *dynamodb.QueryInput, ...func(*dynamodb.Options)) (*dynamodb.QueryOutput, error)
}

type Store struct {
	db    API
	table string
	user  string
	now   func() time.Time
}

func New(db API, table, user string) *Store {
	return &Store{db: db, table: table, user: user, now: time.Now}
}

// stream records carry the item before and after each write. the relay reads
// them, so every change becomes an event without the api publishing anything.
var stream = &types.StreamSpecification{
	StreamEnabled:  aws.Bool(true),
	StreamViewType: types.StreamViewTypeNewAndOldImages,
}

// EnsureTable creates the table and both indexes if missing, and makes sure the
// stream is on. on-demand billing, no capacity planning.
func (s *Store) EnsureTable(ctx context.Context) error {
	out, err := s.db.DescribeTable(ctx, &dynamodb.DescribeTableInput{TableName: &s.table})
	if err == nil {
		spec := out.Table.StreamSpecification
		if spec != nil && aws.ToBool(spec.StreamEnabled) {
			return nil
		}
		// tables made before step 4 have no stream yet.
		_, err = s.db.UpdateTable(ctx, &dynamodb.UpdateTableInput{TableName: &s.table, StreamSpecification: stream})
		return err
	}
	var missing *types.ResourceNotFoundException
	if !errors.As(err, &missing) {
		return fmt.Errorf("describe table: %w", err)
	}
	attr := func(name string) types.AttributeDefinition {
		return types.AttributeDefinition{AttributeName: aws.String(name), AttributeType: types.ScalarAttributeTypeS}
	}
	all := &types.Projection{ProjectionType: types.ProjectionTypeAll}
	_, err = s.db.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName:   &s.table,
		BillingMode: types.BillingModePayPerRequest,
		AttributeDefinitions: []types.AttributeDefinition{
			attr("PK"), attr("SK"), attr("GSI1PK"), attr("GSI1SK"), attr("GSI2PK"), attr("GSI2SK"),
		},
		KeySchema: keySchema("PK", "SK"),
		GlobalSecondaryIndexes: []types.GlobalSecondaryIndex{
			{IndexName: aws.String(gsi1), KeySchema: keySchema("GSI1PK", "GSI1SK"), Projection: all},
			{IndexName: aws.String(gsi2), KeySchema: keySchema("GSI2PK", "GSI2SK"), Projection: all},
		},
		StreamSpecification: stream,
	})
	if err != nil {
		return fmt.Errorf("create table: %w", err)
	}
	return nil
}

func keySchema(pk, sk string) []types.KeySchemaElement {
	return []types.KeySchemaElement{
		{AttributeName: aws.String(pk), KeyType: types.KeyTypeHash},
		{AttributeName: aws.String(sk), KeyType: types.KeyTypeRange},
	}
}

// StreamARN is the address the relay reads changes from.
func (s *Store) StreamARN(ctx context.Context) (string, error) {
	out, err := s.db.DescribeTable(ctx, &dynamodb.DescribeTableInput{TableName: &s.table})
	if err != nil {
		return "", err
	}
	if out.Table.LatestStreamArn == nil {
		return "", errors.New("table has no stream; run EnsureTable")
	}
	return *out.Table.LatestStreamArn, nil
}

func (s *Store) DeleteTable(ctx context.Context) error {
	_, err := s.db.DeleteTable(ctx, &dynamodb.DeleteTableInput{TableName: &s.table})
	return err
}

// CreateJob writes a new job. attribute_not_exists makes it idempotent:
// a second write returns ErrExists instead of overwriting.
func (s *Store) CreateJob(ctx context.Context, j pipeline.Job) (pipeline.JobView, error) {
	if j.Tags == nil {
		j.Tags = []string{}
	}
	if j.AddedAt == "" {
		j.AddedAt = s.now().UTC().Format(time.RFC3339)
	}
	if err := j.Validate(); err != nil {
		return pipeline.JobView{}, err
	}
	item, err := attributevalue.MarshalMap(newJobItem(s.user, j, 1))
	if err != nil {
		return pipeline.JobView{}, err
	}
	_, err = s.db.PutItem(ctx, &dynamodb.PutItemInput{
		TableName:           &s.table,
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(PK)"),
	})
	if isConditionFailed(err) {
		return pipeline.JobView{}, pipeline.ErrExists
	}
	if err != nil {
		return pipeline.JobView{}, err
	}
	return pipeline.JobView{Job: j, Version: 1, Drafts: []pipeline.Draft{}}, nil
}

// ListJobs returns all jobs and drafts in one item-collection query.
// paginated, dynamodb returns at most 1 mb per page.
func (s *Store) ListJobs(ctx context.Context) ([]pipeline.JobView, error) {
	items, err := s.query(ctx, &dynamodb.QueryInput{
		TableName:              &s.table,
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :job)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk":  &types.AttributeValueMemberS{Value: userPK(s.user)},
			":job": &types.AttributeValueMemberS{Value: "JOB#"},
		},
	})
	if err != nil {
		return nil, err
	}
	return assemble(items, "")
}

// GetJob reads one job and its drafts in one query.
func (s *Store) GetJob(ctx context.Context, id string) (pipeline.JobView, error) {
	items, err := s.query(ctx, &dynamodb.QueryInput{
		TableName:              &s.table,
		KeyConditionExpression: aws.String("PK = :pk AND begins_with(SK, :job)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk":  &types.AttributeValueMemberS{Value: userPK(s.user)},
			":job": &types.AttributeValueMemberS{Value: jobSK(id)},
		},
	})
	if err != nil {
		return pipeline.JobView{}, err
	}
	views, err := assemble(items, id)
	if err != nil {
		return pipeline.JobView{}, err
	}
	if len(views) == 0 {
		return pipeline.JobView{}, pipeline.ErrNotFound
	}
	return views[0], nil
}

// JobsByStage queries GSI2: one partition per stage, sorted by added date.
func (s *Store) JobsByStage(ctx context.Context, stage pipeline.Stage) ([]pipeline.JobView, error) {
	if !stage.Valid() {
		return nil, pipeline.Invalid("unknown stage %q", stage)
	}
	items, err := s.query(ctx, &dynamodb.QueryInput{
		TableName:              &s.table,
		IndexName:              aws.String(gsi2),
		KeyConditionExpression: aws.String("GSI2PK = :pk"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk": &types.AttributeValueMemberS{Value: stagePK(s.user, stage)},
		},
	})
	if err != nil {
		return nil, err
	}
	return jobsOnly(items)
}

// DueFollowUps range-reads the sparse GSI1 by follow-up date. no scan.
func (s *Store) DueFollowUps(ctx context.Context, until string) ([]pipeline.JobView, error) {
	items, err := s.query(ctx, &dynamodb.QueryInput{
		TableName:              &s.table,
		IndexName:              aws.String(gsi1),
		KeyConditionExpression: aws.String("GSI1PK = :pk AND GSI1SK <= :until"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":pk":    &types.AttributeValueMemberS{Value: followUpPK(s.user)},
			":until": &types.AttributeValueMemberS{Value: until + "#" + upperBound},
		},
	})
	if err != nil {
		return nil, err
	}
	return jobsOnly(items)
}

// ChangeStage is read-modify-write with optimistic locking. it updates only the
// stage attributes, guarded by Version = expected, so a stale write gets
// ErrConflict while the checker's health writes never collide with it.
func (s *Store) ChangeStage(ctx context.Context, id string, c pipeline.StageChange) (pipeline.JobView, pipeline.Stage, error) {
	current, err := s.GetJob(ctx, id)
	if err != nil {
		return pipeline.JobView{}, "", err
	}
	expected := current.Version
	if c.ExpectedVersion != 0 {
		if c.ExpectedVersion != current.Version {
			return pipeline.JobView{}, "", pipeline.ErrConflict
		}
		expected = c.ExpectedVersion
	}
	next, err := current.Job.Apply(c, s.now())
	if err != nil {
		return pipeline.JobView{}, "", err
	}
	keys := newJobItem(s.user, next, expected+1)
	update := expression.
		Set(expression.Name("stage"), expression.Value(next.Stage)).
		Set(expression.Name("GSI2PK"), expression.Value(keys.GSI2PK)).
		Set(expression.Name("Version"), expression.Value(expected+1))
	// optional fields: set when present, remove when empty.
	for name, value := range map[string]string{
		"channel": next.Channel, "followUp": next.FollowUp, "appliedAt": next.AppliedAt,
		"GSI1PK": keys.GSI1PK, "GSI1SK": keys.GSI1SK,
	} {
		if value == "" {
			update = update.Remove(expression.Name(name))
		} else {
			update = update.Set(expression.Name(name), expression.Value(value))
		}
	}
	update = update.Set(expression.Name("notes"), expression.Value(next.Notes))
	expr, err := expression.NewBuilder().
		WithUpdate(update).
		WithCondition(expression.Name("Version").Equal(expression.Value(expected))).
		Build()
	if err != nil {
		return pipeline.JobView{}, "", err
	}
	_, err = s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: &s.table,
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: userPK(s.user)},
			"SK": &types.AttributeValueMemberS{Value: jobSK(id)},
		},
		UpdateExpression:          expr.Update(),
		ConditionExpression:       expr.Condition(),
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
	})
	if isConditionFailed(err) {
		return pipeline.JobView{}, "", pipeline.ErrConflict
	}
	if err != nil {
		return pipeline.JobView{}, "", err
	}
	return pipeline.JobView{Job: next, Version: expected + 1, Drafts: current.Drafts}, current.Stage, nil
}

// AddDraft stores a draft next to its job. conditions only see the item being
// written, so the job is read first to reject drafts for missing jobs.
func (s *Store) AddDraft(ctx context.Context, d pipeline.Draft) (pipeline.Draft, error) {
	if _, err := s.GetJob(ctx, d.JobID); err != nil {
		return pipeline.Draft{}, err
	}
	if d.CreatedAt == "" {
		d.CreatedAt = s.now().UTC().Format(time.RFC3339Nano)
	}
	if d.Mode == "" {
		d.Mode = "ai"
	}
	item, err := attributevalue.MarshalMap(newDraftItem(s.user, d))
	if err != nil {
		return pipeline.Draft{}, err
	}
	_, err = s.db.PutItem(ctx, &dynamodb.PutItemInput{
		TableName:           &s.table,
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(PK)"),
	})
	if isConditionFailed(err) {
		return pipeline.Draft{}, pipeline.ErrExists
	}
	return d, err
}

// UpdateDraft sets subject and body with UpdateItem. the sort key holds
// createdAt, so the draft is looked up first.
func (s *Store) UpdateDraft(ctx context.Context, jobID, draftID, subject, body string) (pipeline.Draft, error) {
	view, err := s.GetJob(ctx, jobID)
	if err != nil {
		return pipeline.Draft{}, err
	}
	for _, d := range view.Drafts {
		if d.ID != draftID {
			continue
		}
		d.Subject, d.Body = subject, body
		d.UpdatedAt = s.now().UTC().Format(time.RFC3339)
		_, err := s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
			TableName: &s.table,
			Key: map[string]types.AttributeValue{
				"PK": &types.AttributeValueMemberS{Value: userPK(s.user)},
				"SK": &types.AttributeValueMemberS{Value: draftSK(d)},
			},
			UpdateExpression:    aws.String("SET subject = :s, body = :b, updatedAt = :u"),
			ConditionExpression: aws.String("attribute_exists(PK)"),
			ExpressionAttributeValues: map[string]types.AttributeValue{
				":s": &types.AttributeValueMemberS{Value: subject},
				":b": &types.AttributeValueMemberS{Value: body},
				":u": &types.AttributeValueMemberS{Value: d.UpdatedAt},
			},
		})
		if isConditionFailed(err) {
			return pipeline.Draft{}, pipeline.ErrNotFound
		}
		return d, err
	}
	return pipeline.Draft{}, pipeline.ErrNotFound
}

// SetHealth records a listing check. it only sets the health attribute, so it
// does not touch Version and cannot conflict with a user's stage change.
func (s *Store) SetHealth(ctx context.Context, id string, health map[string]any) error {
	h, err := attributevalue.Marshal(health)
	if err != nil {
		return err
	}
	_, err = s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: &s.table,
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: userPK(s.user)},
			"SK": &types.AttributeValueMemberS{Value: jobSK(id)},
		},
		UpdateExpression:          aws.String("SET health = :h"),
		ConditionExpression:       aws.String("attribute_exists(PK)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{":h": h},
	})
	if isConditionFailed(err) {
		return pipeline.ErrNotFound
	}
	return err
}

// MarkFollowUpDue flags a job whose follow-up date has come. the condition makes
// it fire once per date: a second call, or a second scheduler, gets false.
// the relay turns this change into a followup.due event.
func (s *Store) MarkFollowUpDue(ctx context.Context, id, date string) (bool, error) {
	_, err := s.db.UpdateItem(ctx, &dynamodb.UpdateItemInput{
		TableName: &s.table,
		Key: map[string]types.AttributeValue{
			"PK": &types.AttributeValueMemberS{Value: userPK(s.user)},
			"SK": &types.AttributeValueMemberS{Value: jobSK(id)},
		},
		UpdateExpression:    aws.String("SET followUpDue = :d"),
		ConditionExpression: aws.String("followUp = :d AND (attribute_not_exists(followUpDue) OR followUpDue <> :d)"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":d": &types.AttributeValueMemberS{Value: date},
		},
	})
	if isConditionFailed(err) {
		return false, nil
	}
	return err == nil, err
}

func (s *Store) query(ctx context.Context, in *dynamodb.QueryInput) ([]map[string]types.AttributeValue, error) {
	var items []map[string]types.AttributeValue
	pages := dynamodb.NewQueryPaginator(s.db, in)
	for pages.HasMorePages() {
		page, err := pages.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("query: %w", err)
		}
		items = append(items, page.Items...)
	}
	return items, nil
}

// assemble groups Job and Draft items into JobViews.
// with onlyJob set, items from other jobs sharing the prefix are dropped.
func assemble(items []map[string]types.AttributeValue, onlyJob string) ([]pipeline.JobView, error) {
	views := map[string]*pipeline.JobView{}
	var order []string
	var drafts []pipeline.Draft
	for _, raw := range items {
		sk := raw["SK"].(*types.AttributeValueMemberS).Value
		if onlyJob != "" && !belongsTo(sk, onlyJob) {
			continue
		}
		switch raw["Type"].(*types.AttributeValueMemberS).Value {
		case typeJob:
			var it jobItem
			if err := attributevalue.UnmarshalMap(raw, &it); err != nil {
				return nil, err
			}
			views[it.ID] = &pipeline.JobView{Job: it.Job, Version: it.Version, Drafts: []pipeline.Draft{}}
			order = append(order, it.ID)
		case typeDraft:
			var it draftItem
			if err := attributevalue.UnmarshalMap(raw, &it); err != nil {
				return nil, err
			}
			drafts = append(drafts, it.Draft)
		}
	}
	for _, d := range drafts {
		if v, ok := views[d.JobID]; ok {
			v.Drafts = append(v.Drafts, d)
		}
	}
	out := make([]pipeline.JobView, 0, len(order))
	for _, id := range order {
		v := views[id]
		sort.Slice(v.Drafts, func(a, b int) bool { return v.Drafts[a].CreatedAt > v.Drafts[b].CreatedAt })
		out = append(out, *v)
	}
	return out, nil
}

func jobsOnly(items []map[string]types.AttributeValue) ([]pipeline.JobView, error) {
	out := make([]pipeline.JobView, 0, len(items))
	for _, raw := range items {
		var it jobItem
		if err := attributevalue.UnmarshalMap(raw, &it); err != nil {
			return nil, err
		}
		out = append(out, pipeline.JobView{Job: it.Job, Version: it.Version, Drafts: []pipeline.Draft{}})
	}
	return out, nil
}

func isConditionFailed(err error) bool {
	var cf *types.ConditionalCheckFailedException
	return errors.As(err, &cf)
}
