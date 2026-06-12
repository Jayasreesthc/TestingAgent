import os
import boto3
import logging
import functools
from botocore.exceptions import ClientError

logger = logging.getLogger("psychegraph.s3")

AWS_ACCESS_KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION            = os.getenv("AWS_REGION", "ap-south-1")
S3_BUCKET             = os.getenv("S3_BUCKET_NAME")
PRESIGNED_URL_EXPIRY  = int(os.getenv("S3_URL_EXPIRY_SECONDS", 3600))  # 1 hour default


@functools.lru_cache(maxsize=1)
def _client():
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )


def upload_audio(file_bytes: bytes, s3_key: str, content_type: str = "audio/mpeg") -> str:
    """
    Upload audio bytes to S3.
    Returns the S3 key (stored in DB as audio_url).
    """
    try:
        _client().put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
        )
        logger.info(f"[S3] Uploaded: {s3_key}")
        return s3_key
    except ClientError as e:
        logger.error(f"[S3] Upload failed for {s3_key}: {e}")
        raise


def get_presigned_url(s3_key: str, expiry: int = PRESIGNED_URL_EXPIRY) -> str:
    """
    Generate a temporary pre-signed URL to stream/download the audio file.
    Expires after `expiry` seconds (default 1 hour).
    """
    try:
        url = _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key},
            ExpiresIn=expiry,
        )
        logger.info(f"[S3] Presigned URL generated for {s3_key}")
        return url
    except ClientError as e:
        logger.error(f"[S3] Presigned URL failed for {s3_key}: {e}")
        raise


def delete_audio(s3_key: str) -> None:
    """Delete an audio file from S3 — called when session is deleted."""
    try:
        _client().delete_object(Bucket=S3_BUCKET, Key=s3_key)
        logger.info(f"[S3] Deleted: {s3_key}")
    except ClientError as e:
        logger.warning(f"[S3] Delete failed for {s3_key}: {e}")

def upload_image(file_bytes: bytes, s3_key: str, content_type: str = "image/png") -> str:
    """
    Upload image bytes to S3.
    Returns the S3 key (stored in DB as logo_url).
    """
    try:
        _client().put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
        )
        logger.info(f"[S3] Uploaded image: {s3_key}")
        return s3_key
    except ClientError as e:
        logger.error(f"[S3] Image upload failed for {s3_key}: {e}")
        raise


def get_image_url(s3_key: str, expiry: int = PRESIGNED_URL_EXPIRY) -> str:
    """Generate a presigned URL for an image."""
    try:
        url = _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key},
            ExpiresIn=expiry,
        )
        return url
    except ClientError as e:
        logger.error(f"[S3] Image presigned URL failed for {s3_key}: {e}")
        raise


def delete_image(s3_key: str) -> None:
    """Delete an image from S3."""
    try:
        _client().delete_object(Bucket=S3_BUCKET, Key=s3_key)
        logger.info(f"[S3] Deleted image: {s3_key}")
    except ClientError as e:
        logger.warning(f"[S3] Image delete failed for {s3_key}: {e}")


def upload_document(file_bytes: bytes, s3_key: str, content_type: str = "application/octet-stream") -> str:
    """
    Upload a patient medical record document to S3.
    Returns the S3 key (stored in DB).
    """
    try:
        _client().put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
        )
        logger.info(f"[S3] Uploaded document: {s3_key}")
        return s3_key
    except ClientError as e:
        logger.error(f"[S3] Document upload failed for {s3_key}: {e}")
        raise

def get_document_url(s3_key: str, expiry: int = PRESIGNED_URL_EXPIRY) -> str:
    """Generate a presigned URL for a patient document."""
    try:
        url = _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key},
            ExpiresIn=expiry,
        )
        return url
    except ClientError as e:
        logger.error(f"[S3] Document presigned URL failed for {s3_key}: {e}")
        raise

def delete_document(s3_key: str) -> None:
    """Delete a patient document from S3."""
    try:
        _client().delete_object(Bucket=S3_BUCKET, Key=s3_key)
        logger.info(f"[S3] Deleted document: {s3_key}")
    except ClientError as e:
        logger.warning(f"[S3] Document delete failed for {s3_key}: {e}")