provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "widget_bucket" {
  bucket = "your-bucket-name" # TODO: update name
}

resource "aws_s3_bucket_public_access_block" "public_access" {
  bucket = aws_s3_bucket.widget_bucket.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "public_read" {
  bucket = aws_s3_bucket.widget_bucket.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.widget_bucket.arn}/*"
    }]
  })
}

resource "aws_lambda_function" "widget_lambda" {
  filename      = "lambda.zip"
  function_name = "leetcodeWidget"
  role          = aws_iam_role.lambda_role.arn
  handler       = "server.handler"
  runtime       = "nodejs18.x"
  source_code_hash = filebase64sha256("lambda.zip")
}

resource "aws_iam_role" "lambda_role" {
  name = "leetcode_lambda_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_s3_policy" {
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:PutObjectAcl"]
      Resource = "${aws_s3_bucket.widget_bucket.arn}/*"
    }, {
      Effect   = "Allow"
      Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "*"
    }]
  })
}