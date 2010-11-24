#!/usr/bin/env sh

# This example script uses "nTunes" to iterate through the track list CRITERIA,
# and using the result as the playlist for the Icecast server.
#   Usage:  ./decodeFromNTunes.sh | node server.js

# The hostname and port of our Node Icecast server.
ICECAST=localhost:5555

# The filter command to send to nTunes. In this case, get all my "Pink Floyd" songs.
CRITERIA="/source/1/playlist/1/track/artist=Pink%20Floyd"

# The hostname and port of the 'nTunes' server.
NTUNES=localhost:8888

# The concatenated 'curl' command to use when communicating with the nTunes server.
CURL="curl --silent $NTUNES$CRITERIA"

while (true);
  do

  # First, get the total count of the selected criteria.
  N=`$CURL/count`;

  # Loop through each entry of the temp file, invoking a 'metadata' event, and decoding the FLAC file.
  i="1";
  while [ $i -lt $N ]
    do
    
    # Get the location, name, artist and album of the track.
    LOCATION=`$CURL/$i/location?format=txt`
    NAME=`$CURL/$i/name?format=txt`
    ARTIST=`$CURL/$i/artist?format=txt`
    ALBUM=`$CURL/$i/album?format=txt`
    DURATION=`$CURL/$i/duration?format=txt`

    # Set a 'metadata' event to update the current track
    curl --silent -X POST -u "node:rules" -H "X-Current-Track: $NAME - $ARTIST - $ALBUM" -H "X-Duration: $DURATION" "$ICECAST/metadata" > /dev/null;

    # Use 'lame' to decode the MP3 to raw PCM, 44100
    lame --mp3input "$LOCATION" --decode -t -s 44.1 --signed --little-endian -;

    i=$[ $i + 1 ];

  done;
done;
