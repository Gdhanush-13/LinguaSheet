#!/usr/bin/env bash
set -euo pipefail

# Run this on a new Oracle Cloud Always Free Ampere A1 Ubuntu VM.
# The script does not create cloud resources or configure billing.

sudo apt-get update
sudo apt-get install -y ca-certificates curl git docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

read -r -p "GitHub HTTPS repository URL: " REPOSITORY_URL
sudo mkdir -p /opt/linguasheet
sudo chown "$USER":"$USER" /opt/linguasheet
git clone "$REPOSITORY_URL" /opt/linguasheet
cd /opt/linguasheet
docker compose -f docker-compose.oracle.yml up -d --build
curl --fail http://127.0.0.1:8080/health
echo "LinguaSheet backend is running on port 8080. Configure the VM firewall and reverse proxy before making it public."
