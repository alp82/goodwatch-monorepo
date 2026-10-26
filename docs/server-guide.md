# Server guide

Running the full GoodWatch infrastructure is more involved than running the web app. This guide is incomplete.


## Cache Cluster

Three Valkey 8 nodes in cluster mode, from the Compose files in `goodwatch-cache/`. See
[private-redis.md](private-redis.md) for the configuration and the procedures.

## Data Pipeline DB Cluster

https://medium.com/workleap/the-only-local-mongodb-replica-set-with-docker-compose-guide-youll-ever-need-2f0b74dd8384

```
openssl rand -base64 756 > mongodb-keyfile
```


https://github.com/csuka/ansible_role_mongodb_ubuntu

```
ansible-galaxy collection install community.mongodb
ansible-galaxy install csuka.mongodb_ubuntu
ansible-playbook -i inventory.ini playbook.yml
```

## Windmill Server & Workers

TODO

## Adding a new Server

### Install Packages
```
apt-get install make fzf
```

### Install Docker
https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository

### Git Repository
```
git clone https://github.com/alp82/goodwatch-monorepo.git
```

### Grafana Exporter

### Windmill Worker

### Backup
sshfs
```
apt-get update && apt-get install sshfs
```

fstab
```
u123456-subX@u123456-subX.your-storagebox.de:/home /mnt/backup-xxx fuse.sshfs _netdev,port=23,IdentityFile=/root/.ssh/id_rsa,allow_other,reconnect,ServerAliveInterval=15,ServerAliveCountMax=3 0 0
```

uv
```
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Troubleshooting

### Not enough disc space
```
docker image prune -a
docker builder prune
```

### Relocate docker root directory
https://www.ibm.com/docs/en/z-logdata-analytics/5.1.0?topic=compose-relocating-docker-root-directory
