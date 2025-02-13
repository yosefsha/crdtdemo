#!/bin/bash

# Create EKS cluster
eksctl create cluster --name my-demo-cluster  --region us-east-1 --nodegroup-name standard-workers --node-type t3.micro --nodes 2 --nodes-min 1 --nodes-max 4  
if [ -f "eksctl_arm64.tar.gz" ] && [ -s "eksctl_arm64.tar.gz" ]; then
    echo "Download successful"
else
    echo "Download failed"
fi