# ============================================
# K3s Cluster for TranslitAI
# Adapted from cookiecutter-microservices-template
# ============================================

# ============================================
# Variables for K3s cluster
# ============================================

variable "k3s_version" {
  description = "K3s version to install"
  type        = string
  default     = "v1.29.0+k3s1"
}

variable "domain" {
  description = "Domain for the cluster"
  type        = string
  default     = "alignai.com"
}

variable "environment" {
  description = "Environment (staging/production)"
  type        = string
  default     = "production"
}

variable "master_server_type" {
  description = "Hetzner server type for K3s master"
  type        = string
  default     = "cpx41"  # 8 vCPU, 16GB RAM - faster builds
}

variable "worker_server_type" {
  description = "Hetzner server type for K3s worker"
  type        = string
  default     = "cx33"  # 4 vCPU, 8GB RAM - for workloads
}

# ============================================
# Network Configuration
# ============================================

resource "hcloud_network" "k3s_network" {
  name     = "align-k3s-network"
  ip_range = "10.0.0.0/16"
}

resource "hcloud_network_subnet" "k3s_subnet" {
  network_id   = hcloud_network.k3s_network.id
  type         = "cloud"
  network_zone = "eu-central"
  ip_range     = "10.0.1.0/24"
}

# ============================================
# SSH Key for K3s Cluster
# ============================================

resource "hcloud_ssh_key" "k3s" {
  name       = "align-k3s-key"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

# ============================================
# Firewall for K3s Cluster
# ============================================

resource "hcloud_firewall" "k3s" {
  name = "align-k3s-firewall"
  
  # SSH
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  
  # HTTP
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  
  # HTTPS
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  
  # Kubernetes API
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "6443"
    source_ips = ["0.0.0.0/0", "::/0"]
  }
  
  # NodePort range (for testing)
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "30000-32767"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  # Allow all internal traffic from the private network
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "any"
    source_ips = ["10.0.0.0/16"]
  }
  rule {
    direction  = "in"
    protocol   = "udp"
    port       = "any"
    source_ips = ["10.0.0.0/16"]
  }
  rule {
    direction  = "in"
    protocol   = "icmp"
    source_ips = ["10.0.0.0/16"]
  }
}

# ============================================
# K3s Master Node
# ============================================

resource "hcloud_server" "k3s_master" {
  name        = "align-k3s-master"
  image       = "ubuntu-22.04"
  server_type = var.master_server_type
  location    = var.location
  ssh_keys    = [hcloud_ssh_key.k3s.id]
  
  firewall_ids = [hcloud_firewall.k3s.id]
  
  network {
    network_id = hcloud_network.k3s_network.id
    ip         = "10.0.1.10"
  }
  
  labels = {
    role        = "master"
    environment = var.environment
    project     = "alignai"
  }
  
  user_data = <<-EOF
    #!/bin/bash
    set -e
    
    # Update system
    apt-get update && apt-get upgrade -y
    
    # Install prerequisites
    apt-get install -y curl
    
    echo "System updated and ready for k3s installation"
  EOF

  depends_on = [hcloud_network_subnet.k3s_subnet]
}

# Install k3s after server is created
resource "null_resource" "k3s_master_install" {
  depends_on = [hcloud_server.k3s_master]
  
  triggers = {
    master_id = hcloud_server.k3s_master.id
  }
  
  connection {
    type        = "ssh"
    host        = hcloud_server.k3s_master.ipv4_address
    user        = "root"
    private_key = file(pathexpand(var.ssh_private_key_path))
    timeout     = "5m"
  }
  
  provisioner "remote-exec" {
    inline = [
      "echo 'Waiting for cloud-init to complete...'",
      "cloud-init status --wait || true",
      "sleep 10",
      
      "echo 'Installing k3s...'",
      "curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION='${var.k3s_version}' sh -s - server --disable traefik --disable servicelb --write-kubeconfig-mode 644 --node-name align-master --tls-san ${hcloud_server.k3s_master.ipv4_address} --tls-san api.${var.domain}",
      
      "echo 'Waiting for k3s to be ready...'",
      "sleep 30",
      
      "echo 'Installing Helm...'",
      "curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash",
      
      "echo 'K3s master setup complete!'",
    ]
  }
}

# ============================================
# K3s Worker Node
# ============================================

resource "hcloud_server" "k3s_worker" {
  name        = "align-k3s-worker-1"
  image       = "ubuntu-22.04"
  server_type = var.worker_server_type
  location    = var.location
  ssh_keys    = [hcloud_ssh_key.k3s.id]
  
  firewall_ids = [hcloud_firewall.k3s.id]
  
  network {
    network_id = hcloud_network.k3s_network.id
    ip         = "10.0.1.11"
  }
  
  labels = {
    role        = "worker"
    environment = var.environment
    project     = "alignai"
  }
  
  depends_on = [hcloud_server.k3s_master]
}

# Join worker to cluster
resource "null_resource" "k3s_worker_join" {
  depends_on = [null_resource.k3s_master_install, hcloud_server.k3s_worker]
  
  triggers = {
    worker_id = hcloud_server.k3s_worker.id
  }
  
  connection {
    type        = "ssh"
    host        = hcloud_server.k3s_worker.ipv4_address
    user        = "root"
    private_key = file(pathexpand(var.ssh_private_key_path))
    timeout     = "5m"
  }
  
  provisioner "remote-exec" {
    inline = [
      "echo 'Waiting for system to be ready...'",
      "cloud-init status --wait || true",
      "apt-get update && apt-get install -y curl",
      "sleep 10",
    ]
  }
}

resource "null_resource" "k3s_worker_cluster_join" {
  depends_on = [null_resource.k3s_worker_join]
  
  provisioner "local-exec" {
    command = <<-EOT
      # Get token from master
      echo "Getting token from master..."
      TOKEN=$(ssh -o StrictHostKeyChecking=no root@${hcloud_server.k3s_master.ipv4_address} 'cat /var/lib/rancher/k3s/server/node-token')
      
      # Join worker to cluster
      echo "Joining worker to cluster..."
      ssh -o StrictHostKeyChecking=no root@${hcloud_server.k3s_worker.ipv4_address} \
        "curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION='${var.k3s_version}' K3S_URL='https://10.0.1.10:6443' K3S_TOKEN='$TOKEN' sh -"
      
      echo "Worker joined successfully!"
    EOT
  }
}

# ============================================
# Load Balancer for Ingress
# ============================================

resource "hcloud_load_balancer" "k3s_ingress" {
  name               = "align-k3s-lb"
  load_balancer_type = "lb11"
  location           = var.location
  
  labels = {
    environment = var.environment
    project     = "alignai"
  }
}

resource "hcloud_load_balancer_network" "k3s_ingress" {
  load_balancer_id = hcloud_load_balancer.k3s_ingress.id
  network_id       = hcloud_network.k3s_network.id
  ip               = "10.0.1.100"
}

resource "hcloud_load_balancer_target" "k3s_master" {
  type             = "server"
  load_balancer_id = hcloud_load_balancer.k3s_ingress.id
  server_id        = hcloud_server.k3s_master.id
  use_private_ip   = true
  
  depends_on = [hcloud_load_balancer_network.k3s_ingress]
}

resource "hcloud_load_balancer_target" "k3s_worker" {
  type             = "server"
  load_balancer_id = hcloud_load_balancer.k3s_ingress.id
  server_id        = hcloud_server.k3s_worker.id
  use_private_ip   = true
  
  depends_on = [hcloud_load_balancer_network.k3s_ingress]
}

# HTTP Service
resource "hcloud_load_balancer_service" "http" {
  load_balancer_id = hcloud_load_balancer.k3s_ingress.id
  protocol         = "tcp"
  listen_port      = 80
  destination_port = 80
  proxyprotocol    = true
  
  health_check {
    protocol = "tcp"
    port     = 80
    interval = 10
    timeout  = 5
    retries  = 3
  }
}

# HTTPS Service
resource "hcloud_load_balancer_service" "https" {
  load_balancer_id = hcloud_load_balancer.k3s_ingress.id
  protocol         = "tcp"
  listen_port      = 443
  destination_port = 443
  proxyprotocol    = true
  
  health_check {
    protocol = "tcp"
    port     = 443
    interval = 10
    timeout  = 5
    retries  = 3
  }
}

# ============================================
# Outputs
# ============================================

output "k3s_master_ip" {
  description = "Public IP of K3s master node"
  value       = hcloud_server.k3s_master.ipv4_address
}

output "k3s_worker_ip" {
  description = "Public IP of K3s worker node"
  value       = hcloud_server.k3s_worker.ipv4_address
}

output "k3s_lb_ip" {
  description = "Public IP of Hetzner Load Balancer (point DNS here)"
  value       = hcloud_load_balancer.k3s_ingress.ipv4
}

output "kubeconfig_command" {
  description = "Command to get kubeconfig from master"
  value       = "ssh root@${hcloud_server.k3s_master.ipv4_address} 'cat /etc/rancher/k3s/k3s.yaml' | sed 's/127.0.0.1/${hcloud_server.k3s_master.ipv4_address}/g' > ~/.kube/align-k3s.yaml"
}
