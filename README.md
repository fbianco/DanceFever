# DANCE FEVER

A dance game for one or two players in front of one webcam, in the style of
Just Dance. A glowing coach dances in the middle of a disco stage: copy the
moves like a mirror, on the beat, and score points for every move you match.
Made by Bianco's Labs.

Built on the camera and body detection of Unicorn Run (`../UnicornRun`).

## Play

1. Double-click **start.bat**. A small window opens (the local game server) and
   your browser shows the game at http://localhost:8080. Keep that window open.
2. Click **CLICK TO START** and allow the camera.
3. Stand 2 to 3 m from the webcam so it sees you from head to knees (feet are
   even better): **player 1 on the left, player 2 on the right** (as seen in
   the camera mirror).
4. **Raise both hands** for a second to join.
5. Pick your dancer: **left hand up** = previous, **right hand up** = next,
   **both hands up** = ready. Four dancers: UNI the unicorn, BOLT the robot,
   MIMI the cat and ZAP the alien.
6. Pick a dance the same way, then copy the coach!

| Dance          | Level  | Tempo   | What you do |
|----------------|--------|---------|-------------|
| SUGAR DISCO    | easy   | 108 BPM | arms only: disco points, hands on hips, waves |
| ROBO BOOGIE    | medium | 116 BPM | robot arms, zig-zags, dabs, points |
| STARLIGHT POP  | hard   | 124 BPM | legs too (kicks, flamingos, stars) + a fast clap part |

The move cards at the bottom slide into the white box exactly when you should
be in that pose. Each move is rated **PERFECT / GOOD / OK / MISS**; golden cards
are **gold moves** (double points). Hits in a row build a combo (up to +50 %).
At the end you get up to five stars, and with two players, a winner.
Both hands up = dance again, one hand up = choose another song.

Keyboard and mouse work in the menus (dancing needs the camera):

| Player 1 | Player 2 | |
|---|---|---|
| A / D | Left / Right | previous / next |
| W | Up | join / ready |

Enter go, P pause, M mute, V hide the camera panel, R retry the camera,
Esc back. Without a webcam, players who join with the keyboard get an AUTO
dancer so the game can still be watched.

## How the scoring works

The camera picture goes through Google's MediaPipe Pose model, which finds 33
points on each body. The game turns them into the **directions** of nine
bones (upper arms, forearms, thighs, shins, torso) and compares each with the
coach's: the angle between the two directions is `acos(u · v)`. Under 20° a
bone scores 1, beyond 70° it scores 0. The move's score is the weighted
average, and the best score inside a short window around the beat
(0.2 s early to 0.5 s late) gives the rating. Only directions are compared,
so your height and where you stand do not matter. Legs only count in moves
that use them. The camera panel colours your bones green or red live.

The music is synthesised in the browser, and its audio clock is the game's
clock, so the coach, the move cards and the judge stay in time with what you
hear. If your speakers are late (Bluetooth), add `?latency=150` (ms) to the
address.

## Troubleshooting

- **Black camera / "Camera blocked"**: allow the camera for localhost in the
  browser's address bar, close other apps using the webcam, then press R.
- **Moves are not recognised**: step back until the camera panel shows your
  whole upper body including the hands when they are raised; use good light.
- **Players swap**: stay on your own half of the camera picture (the dashed
  line in the camera panel).
- **Slow tracking**: open http://localhost:8080/?delegate=CPU to skip the
  graphics card, or close other heavy tabs.
- **Opening index.html directly does not work**: browsers block the webcam
  and JavaScript modules for files. Always use start.bat.

## Project layout

```
index.html, css/style.css   page + camera side panel
src/main.js                  wiring, screens, fixed-timestep loop
src/config.js                every tuning constant (scoring, avatars, keys)
src/dance/                   poses (geometry + move library), Matcher (pose score),
                             Session (judge + coach animation), choreos (3 dances + songs), Bot
src/input/                   PoseTracker (webcam + MediaPipe, 2 people), PlayerAssigner,
                             BodyReader (landmarks -> bone directions), MenuGestures, Keyboard
src/render/                  Renderer (screens, HUD), avatars (dancers, coach, move cards),
                             Stage (disco), Particles
src/audio/                   Sound (effects), Music (sequencer + master clock)
vendor/mediapipe/            Google MediaPipe Tasks Vision 0.10.14 (Apache-2.0)
models/                      pose_landmarker_lite.task (Apache-2.0)
tests/                       automated tests
serve.ps1, start.bat         local web server for Windows, nothing to install
```

Debug addresses: `/?demo` two AUTO dancers (add `&song=0..2`, `&from=40`
to start 40 s in, `&solo`, `&a1=0..3&a2=0..3` for the dancers),
`/?lobby` skip the start card, `/?songs` straight to the song choice.

## Tests

With Node.js installed: `npm test`. The tests check the pose geometry
(camera points -> directions -> back), that the score does not depend on
size or position, that two moves in a row never look alike, the hand-raise
menu controls, the player assignment, and whole simulated dances with AUTO
dancers of different skill.
