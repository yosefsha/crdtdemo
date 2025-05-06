#!/bin/bash

kubectl create secret docker-registry aws-ecr-secret \
  --docker-server=963352896991.dkr.ecr.us-east-1.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region us-east-1) \
  --docker-email=sh.yosef@gmail.com