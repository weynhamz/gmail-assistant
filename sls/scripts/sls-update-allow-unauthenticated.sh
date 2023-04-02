#!/bin/bash

# Get a list of functions in the serverless.yml file and format as args
functions=$(sls print --path functions --transform keys --format text 2>/dev/null | xargs)

# Sort functions as public and private
echo "-------------------------------------------------------------------------"
echo "sorting functions as public or private"
echo "-------------------------------------------------------------------------"
pub=()
prv=()
for fn in ${functions[@]}; do
    # if the `allowUnauthenticated: true` flag is defined for the function flag it to be made public
    if [[ "$(sls print --path functions."$fn" --format yaml 2>/dev/null | xargs)" == *"allowUnauthenticated: true"* ]]; then
        pub+=($fn)
    else
        prv+=($fn)
    fi
done
echo "done"

# Run the mkfunc-pub command for each public function
echo "-------------------------------------------------------------------------"
echo "updating public functions"
echo "-------------------------------------------------------------------------"
for fn in ${pub[@]}; do
    echo "Making function \""$fn"\" public..."
    sls mkfunc-pub --param="function=$fn"
done
echo "done"

echo "-------------------------------------------------------------------------"
echo "updating private functions"
echo "-------------------------------------------------------------------------"
# Run the mkfunc-pvt command for each private function
for fn in ${prv[@]}; do
    echo "Making function \""$fn"\" private..."
    sls mkfunc-pvt --param="function=$fn"
done
echo "done"
