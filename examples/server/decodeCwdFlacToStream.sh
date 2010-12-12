#!/usr/bin/env sh

# Place this script in a directory containing FLAC files. When this script is
# executed, it will forever loop through the files and decode them to stdout,
# where the Node Icecast server will read from.
#   Usage: ./decodeCwdFlacToStream.sh | node server.js

# The hostname and port of our Node Icecast server.
ICECAST=localhost:5555

while (true);
  do

  # First store the list of FLAC files into a temp file.
  TEMP=`mktemp -t list.XXXXXXXX`;
  find "$PWD" -name "*.flac" > "$TEMP";

  # Loop through each entry of the temp file, invoking a 'metadata' event, and decoding the FLAC file.
  while IFS= read -r f <&3;
    do

    # First extract the TITLE, ARITST, and ALBUM from the FLAC file, for the 'metadata' event.
    #TITLE=`metaflac --show-tag=TITLE "$f" | sed "s/TITLE=//"`;
    #ARTIST=`metaflac --show-tag=ARTIST "$f" | sed "s/ARTIST=//"`;
    #ALBUM=`metaflac --show-tag=ALBUM "$f" | sed "s/ALBUM=//"`;

    # Set a 'metadata' event to update the current track
    #curl --silent -X POST -u "node:rules" -H "X-Current-Track: $TITLE - $ARTIST - $ALBUM" "$ICECAST/metadata" > /dev/null;

    # TODO: Use 'flac' to decode, instead of 'ffmpeg'
    ffmpeg -f flac -i "$f" -f s16le -acodec pcm_s16le -ac 2 -ar 44100 -;

  done 3<"$TEMP";

  rm -f "$TEMP";
done;
