#!/bin/bash

# Create EKS cluster
eksctl create cluster --name crdt-demo-cluster \
--region us-east-1 --nodegroup-name standard-workers --node-type t3.micro --nodes 1 --nodes-min 1 --nodes-max 3  \
 --alb-ingress-access \
 --full-ecr-access 

