eksctl create cluster --name crdt-demo-cluster \ 
 --region us-east-1 --nodegroup-name \
 standard-workers --node-type t3.medium\
 --nodes 2 --nodes-min 1 --nodes-max 4  \
 --alb-ingress-access --full-ecr-access