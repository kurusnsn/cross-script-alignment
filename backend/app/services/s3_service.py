import boto3
from botocore.exceptions import ClientError
import structlog
from app.utils.config import get_settings

logger = structlog.get_logger(__name__)

class S3Service:
    def __init__(self):
        settings = get_settings()
        self.enabled = all([settings.aws_access_key_id, settings.aws_secret_access_key, settings.s3_bucket_name])
        
        if self.enabled:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.aws_region,
                endpoint_url=settings.s3_endpoint_url
            )
            self.bucket_name = settings.s3_bucket_name
        else:
            logger.warning("S3 credentials not fully configured. S3 service is disabled.")

    def upload_file(self, file_content, object_name):
        if not self.enabled:
            logger.warning("Attempted to upload to S3 but service is disabled.")
            return None
        
        try:
            self.s3_client.put_object(Bucket=self.bucket_name, Key=object_name, Body=file_content)
            logger.info("File uploaded to S3", bucket=self.bucket_name, key=object_name)
            return f"s3://{self.bucket_name}/{object_name}"
        except ClientError as e:
            logger.error("S3 upload failed", error=str(e))
            return None

_s3_service = None

def get_s3_service():
    global _s3_service
    if _s3_service is None:
        _s3_service = S3Service()
    return _s3_service
