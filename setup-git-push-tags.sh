#!/bin/bash

# Configure git to automatically push tags when pushing commits
git config push.followTags true

echo "Git configured to automatically push tags with commits"

# alt
# push = refs/heads/main:refs/heads/main
# push = refs/tags/*:refs/tags/*
