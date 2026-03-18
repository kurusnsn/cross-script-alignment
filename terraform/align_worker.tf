/*
# ============================================
# SSH Key
# ============================================

resource "hcloud_ssh_key" "align" {
  name       = "align-worker-key"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

# ... [rest of the file content commented out]
*/

