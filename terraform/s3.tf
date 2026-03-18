# ============================================
# Hetzner Object Storage (S3 Compatible)
# ============================================

# Note: As of now, Hetzner Object Storage is often managed via the AWS provider 
# pointed to the Hetzner endpoint, or created manually/via API if not fully 
# supported by the hcloud provider yet.

# The AWS provider is used for S3-compatible storage
provider "aws" {
  alias                       = "hetzner"
  access_key                  = var.s3_access_key
  secret_key                  = var.s3_secret_key
  region                      = "us-east-1" # Often ignored by S3-compatible providers
  skip_credentials_validation = true
  skip_region_validation      = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true
  
  endpoints {
    s3 = var.s3_endpoint
  }
}

/*
resource "aws_s3_bucket" "assets" {
  provider = aws.hetzner
  bucket   = var.bucket_name_assets
}

resource "aws_s3_bucket_public_access_block" "assets_access" {
  provider = aws.hetzner
  bucket   = aws_s3_bucket.assets.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}
*/

