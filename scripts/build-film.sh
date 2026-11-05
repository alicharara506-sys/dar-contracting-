#!/bin/sh
# Builds the two scroll-scrub films from the 10 Kling clips in media-src/.
#   horizontal: media-src/clips16/c01..c10.mp4 -> public/film/film-16x9.mp4 (1600x900)
#   vertical:   media-src/clips9/c01..c10.mp4  -> public/film/film-9x16.mp4 (720x1280)
# 15 fps is enough for scrubbing; a keyframe every 8 frames keeps seeking fast in every browser.
# Run from the project folder: sh scripts/build-film.sh
set -e
F=node_modules/ffmpeg-static/ffmpeg.exe
[ -x "$F" ] || F=node_modules/ffmpeg-static/ffmpeg
mkdir -p public/film

build() { # $1 clip dir, $2 WxH, $3 crf, $4 output
  inputs=""; fc=""
  for i in 01 02 03 04 05 06 07 08 09 10; do inputs="$inputs -i media-src/$1/c$i.mp4"; done
  for k in 0 1 2 3 4 5 6 7 8 9; do fc="$fc[$k:v]fps=15,scale=$2:flags=lanczos,setsar=1,setpts=PTS-STARTPTS[v$k];"; done
  fc="$fc[v0][v1][v2][v3][v4][v5][v6][v7][v8][v9]concat=n=10:v=1:a=0[out]"
  $F -y -loglevel error $inputs -filter_complex "$fc" -map "[out]" -an -c:v libx264 -preset slow -crf "$3" \
    -pix_fmt yuv420p -g 8 -keyint_min 8 -sc_threshold 0 -bf 0 -tune film -movflags +faststart "$4"
  $F -y -loglevel error -i "$4" -frames:v 1 -q:v 3 "$(echo "$4" | sed 's/film-/plot-/; s/\.mp4$/.jpg/')"
}

[ "$1" = "9x16" ] || build clips16 1600:900 26 public/film/film-16x9.mp4
[ "$1" = "16x9" ] || build clips9 720:1280 27 public/film/film-9x16.mp4
ls -la public/film
