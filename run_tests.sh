#!/bin/bash



sudo docker run -ti --rm \
                --network=host  \
                -v `pwd`:/root/workspace:ro \
                -v `pwd`/tests/logs:/root/latest_logs \
                myseleniumbase \
                $@

#TODO: add Dockerfile
#TODO: start app and run tests (if not specified to only start docker)
