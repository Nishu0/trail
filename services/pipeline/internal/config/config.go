// Package config reads env settings and builds the dynamodb client.
package config

import (
	"context"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodbstreams"
)

type Config struct {
	Addr           string
	DynamoEndpoint string
	Table          string
	User           string
	Region         string
	Brokers        []string
	NextURL        string
	// EventSource is "streams" (relay publishes from the change log) or
	// "direct" (the api publishes after each write, the step 3 dual write).
	EventSource string
}

func FromEnv() Config {
	return Config{
		Addr:           env("PIPELINE_ADDR", "127.0.0.1:8080"),
		DynamoEndpoint: env("DYNAMO_ENDPOINT", "http://localhost:8000"),
		Table:          env("DYNAMO_TABLE", "trail-pipeline"),
		User:           env("PIPELINE_USER", "me"),
		Region:         env("AWS_REGION", "ap-south-1"),
		Brokers:        brokers(env("KAFKA_BROKERS", "localhost:9092")),
		NextURL:        env("NEXT_URL", "http://127.0.0.1:3002"),
		EventSource:    env("EVENT_SOURCE", "streams"),
	}
}

// Dynamo returns a dynamodb local client. the sdk needs credentials, any value works locally.
func (c Config) Dynamo(ctx context.Context) (*dynamodb.Client, error) {
	cfg, err := c.aws(ctx)
	if err != nil {
		return nil, err
	}
	return dynamodb.NewFromConfig(cfg, func(o *dynamodb.Options) {
		o.BaseEndpoint = aws.String(c.DynamoEndpoint)
	}), nil
}

// Streams returns a dynamodb streams client. same endpoint as the table locally.
func (c Config) Streams(ctx context.Context) (*dynamodbstreams.Client, error) {
	cfg, err := c.aws(ctx)
	if err != nil {
		return nil, err
	}
	return dynamodbstreams.NewFromConfig(cfg, func(o *dynamodbstreams.Options) {
		o.BaseEndpoint = aws.String(c.DynamoEndpoint)
	}), nil
}

func (c Config) aws(ctx context.Context) (aws.Config, error) {
	return awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(c.Region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider("local", "local", "")),
	)
}

// brokers splits "a:9092,b:9092". KAFKA_BROKERS=off runs without kafka.
func brokers(v string) []string {
	if v == "off" {
		return nil
	}
	return strings.Split(v, ",")
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
