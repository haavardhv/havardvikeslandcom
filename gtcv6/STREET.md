# The people on the street: lines

What the people walking around town say, in Bergensk. There are four voices, each with 13 lines. About 30 people are out at a time, and each speaks with one of the four voices: Gubben's people have grey hair and walk a little slower, and the women wear their hair long.

## Recorded

All 52 lines are recorded and in the game.

| Voice | Who | Recorded by | Direction |
| --- | --- | --- | --- |
| `m1` | **Gubben** | Epidemic Sound's *Paul* | In his seventies, from Sandviken, a Brann fan for life. He has given up on the rain and is grumpy but warm about it. Slow and gravelly. |
| `m2` | **Studenten** | Epidemic Sound's *Benjamin* | In his twenties, a bit hungover, always on his way to or from a night out. Fast and casual. |
| `f1` | **Fruen** | Epidemic Sound's *Melissa* | In her late fifties, carrying bags from Fisketorget, with an opinion on everything. Brisk and a little posh. |
| `f2` | **Optimisten** | Epidemic Sound's *Annie* | In her twenties, in a raincoat, often on the phone. She thinks the sun is coming any minute now. Bright and quick. |

## When they speak

| Lines | When | |
| --- | --- | --- |
| 01–05 | **Forbi**: you walk past, within 3 m | Now and then: one person at a time, at least 8 to 16 s apart, and nobody speaks to you every time you pass |
| 06–09 | **Påkjørt**: you knock them over (running into them, a punch, a scooter, a shot) | Always |
| 10–11 | **Sparkesykkel**: you ride past fast without hitting them | |
| 12–13 | **Redd**: a shot goes off within 28 m | The nearest person cries out, and everyone that close hurries off for a few seconds |

Only one person speaks at a time. A line cuts off a line of the same or lower priority (forbi < sparkesykkel < påkjørt and redd) and is dropped if a higher one is playing. The voice is heard in 3D, from where they stand and following them as they walk on, with your ears at your character's head, turned the way the camera looks; it gets quieter with distance. The scooter radio is never turned down for them, as in real life. The words are also shown in a speech bubble for as long as the line takes to say.

## Adding or redoing recordings

Record each voice as one take, with the 13 lines in order and a pause of about two seconds between them, then run:

```bash
python3 gtcv6/tools/build_street.py m1=paul.mp3 m2=benjamin.mp3 f1=melissa.mp3 f2=annie.mp3
```

Any voice can be redone on its own (just `f2=annie.mp3`, say). The tool levels the take as a whole, cuts it on the pauses, trims each line to 0.12 s of silence at each end, and writes 96 kbps mono MP3 (−16 LUFS, the same as the radio) to `public/audio/street/`, with `clips.json`, the list of lines and their durations that the game reads. It warns if it doesn't find 13 lines in a take. Lines can also come one file each, named after their IDs (`ped_f2_06.wav`), in a folder: `python3 gtcv6/tools/build_street.py path/to/folder`.

A line that isn't recorded is only shown in the bubble. If a line is changed, change it in `STREET_LINES` in `public/js/game.js` too.

## The lines

### `m1`: Gubben

| ID | Line |
| --- | --- |
| `ped_m1_01` | Ja, ja. Det regner. Det har det gjort siden sekstitallet. |
| `ped_m1_02` | Brann tar gull i år. Det sier eg hvert år. |
| `ped_m1_03` | I min tid gikk vi opp disse bakkene to ganger om dagen. |
| `ped_m1_04` | Paraply? Nei, det e for østlendinger. |
| `ped_m1_05` | Hørte du buekorpset i går? Det var tider, det. |
| `ped_m1_06` | Kossen går du, gutten min?! |
| `ped_m1_07` | Au! Ryggen min! |
| `ped_m1_08` | Din tufs! |
| `ped_m1_09` | Herregud, ka e det med ungdommen i dag? |
| `ped_m1_10` | De sparkesyklene skulle vært forbudt! |
| `ped_m1_11` | Sakte, for pokker! |
| `ped_m1_12` | Nei, nei, nei, eg e for gammel for dette! |
| `ped_m1_13` | Ring politiet! Nei, ring kona mi! |

### `m2`: Studenten

| ID | Line |
| --- | --- |
| `ped_m2_01` | Skal du på byen i kveld, eller? |
| `ped_m2_02` | Eg sa til han: Dette e ikkje Norge, dette e Bergen. |
| `ped_m2_03` | Har du sett kor mye en skillingsbolle koster nå? |
| `ped_m2_04` | Seks grader og pøsregn. Shortsvær. |
| `ped_m2_05` | En måke tok kebaben min på Torget. Hele kebaben. |
| `ped_m2_06` | Ey! Ser du ikkje kor du går? |
| `ped_m2_07` | Seriøst, kompis? |
| `ped_m2_08` | Fysj, telefonen min! |
| `ped_m2_09` | Gidder du, eller? |
| `ped_m2_10` | Ey, det e min sparkesykkel! |
| `ped_m2_11` | Sjukt! Gjør det igjen! |
| `ped_m2_12` | Nei, nei, eg stikker! |
| `ped_m2_13` | Dette skal på Snapchat. |

### `f1`: Fruen

| ID | Line |
| --- | --- |
| `ped_f1_01` | Fisketorget e bare for turister nå. Bare turister! |
| `ped_f1_02` | Tre cruiseskip i dag. Tre! Man kommer seg ikkje frem. |
| `ped_f1_03` | Det e ikkje dårlig vær, bare dårlige klær. |
| `ped_f1_04` | Hun på Rema sa det skal bli sol på torsdag. Ha! |
| `ped_f1_05` | Svigersønnen min e fra Oslo. Men han e snill, da. |
| `ped_f1_06` | Uff! Posene mine! |
| `ped_f1_07` | Neimen, har du sett! |
| `ped_f1_08` | Du burde skamme deg! |
| `ped_f1_09` | Kem e foreldrene dine?! |
| `ped_f1_10` | På fortauet?! Nei, nå får det være nok! |
| `ped_f1_11` | Eg skal skrive til BT om deg! |
| `ped_f1_12` | Herregud, ikkje skyt! Eg har fisk i posen! |
| `ped_f1_13` | Dette hadde aldri skjedd på Kalfaret! |

### `f2`: Optimisten

| ID | Line |
| --- | --- |
| `ped_f2_01` | Nei, eg står på Torgallmenningen. Kor e du? |
| `ped_f2_02` | Se! Det e sol på Fløyen! …Nei, nå e den borte. |
| `ped_f2_03` | Eg skal løpe opp på Ulriken i morgen. Kanskje. |
| `ped_f2_04` | Har du prøvd reinsdyrpølsen på Trekroneren? |
| `ped_f2_05` | Regnjakke, paraply, gummistøvler. Klar for sommeren! |
| `ped_f2_06` | Au! Hallo?! |
| `ped_f2_07` | Neimen, ka driver du med?! |
| `ped_f2_08` | Kaffen min! Den var helt ny! |
| `ped_f2_09` | Du må jo se deg for! |
| `ped_f2_10` | Wow. Okei. Fint for deg. |
| `ped_f2_11` | Hjelm, kanskje?! |
| `ped_f2_12` | Mamma, eg ringer deg tilbake! |
| `ped_f2_13` | Løp! Alle sammen, løp! |
