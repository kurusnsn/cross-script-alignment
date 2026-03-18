variable "hcloud_token" {
  description = "Hetzner Cloud API Token"
  type        = string
  sensitive   = true
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key for server access"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "ssh_private_key_path" {
  description = "Path to SSH private key for provisioning"
  type        = string
  default     = "~/.ssh/id_rsa"
}

variable "gateway_ip" {
  description = "IP address of the Gateway server (for firewall rules)"
  type        = string
  default     = "0.0.0.0/0"  # Change this to your Gateway's IP for production
}

variable "server_type" {
  description = "Hetzner server type"
  type        = string
  default     = "cpx41"  # 8 vCPU, 16GB RAM
}

variable "location" {
  description = "Hetzner datacenter location"
  type        = string
  default     = "nbg1"  # Nuremberg, Germany
}

variable "server_name" {
  description = "Name for the worker server"
  type        = string
  default     = "align-worker"
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for alignai.com"
  type        = string
}

variable "s3_access_key" {
  description = "Hetzner Object Storage Access Key"
  type        = string
  sensitive   = true
}

variable "s3_secret_key" {
  description = "Hetzner Object Storage Secret Key"
  type        = string
  sensitive   = true
}

variable "s3_endpoint" {
  description = "Hetzner Object Storage Endpoint"
  type        = string
  default     = "https://nbg1.your-objectstorage.com"
}

variable "bucket_name_assets" {
  description = "Bucket for aligneration assets"
  type        = string
  default     = "align-assets-prod"
}
