provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# API subdomain - points to K3s Load Balancer
resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = hcloud_load_balancer.k3s_ingress.ipv4
  type    = "A"
  proxied = true
}

# WWW subdomain - points to K3s Load Balancer
resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  content = hcloud_load_balancer.k3s_ingress.ipv4
  type    = "A"
  proxied = true
}

# Root domain - points to K3s Load Balancer
resource "cloudflare_record" "root" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  content = hcloud_load_balancer.k3s_ingress.ipv4
  type    = "A"
  proxied = true
}

# Grafana monitoring subdomain
resource "cloudflare_record" "grafana" {
  zone_id = var.cloudflare_zone_id
  name    = "grafana"
  content = hcloud_load_balancer.k3s_ingress.ipv4
  type    = "A"
  proxied = true
}

# ArgoCD management subdomain
resource "cloudflare_record" "argo" {
  zone_id = var.cloudflare_zone_id
  name    = "argo"
  content = hcloud_load_balancer.k3s_ingress.ipv4
  type    = "A"
  proxied = true
}

# Jaeger tracing subdomain
resource "cloudflare_record" "jaeger" {
  zone_id = var.cloudflare_zone_id
  name    = "jaeger"
  content = hcloud_load_balancer.k3s_ingress.ipv4
  type    = "A"
  proxied = true
}

# Dev Environment subdomains
resource "cloudflare_record" "dev" {
  zone_id = var.cloudflare_zone_id
  name    = "dev"
  content = hcloud_load_balancer.k3s_ingress.ipv4
  type    = "A"
  proxied = true
}

resource "cloudflare_record" "api_dev" {
  zone_id = var.cloudflare_zone_id
  name    = "api-dev"
  content = hcloud_load_balancer.k3s_ingress.ipv4
  type    = "A"
  proxied = true
}

# Staging Environment subdomains
resource "cloudflare_record" "staging" {
  zone_id = var.cloudflare_zone_id
  name    = "staging"
  content = hcloud_load_balancer.k3s_ingress.ipv4
  type    = "A"
  proxied = true
}

resource "cloudflare_record" "api_staging" {
  zone_id = var.cloudflare_zone_id
  name    = "api-staging"
  content = hcloud_load_balancer.k3s_ingress.ipv4
  type    = "A"
  proxied = true
}




