# The people on the street: lines

What the people walking around town say, in Bergensk. There are four voices, each with 23 lines (01–13 recorded, 14–23 new), and two new voices waiting for recordings. About 30 people are out at a time, and each speaks with one of the voices: Gubben's people have grey hair and walk a little slower, and the women wear their hair long. A new voice joins the street as soon as any of its lines are recorded.

## Recorded

Lines 01–13 of the four voices below (52 lines) are recorded and in the game. Lines 14–23 of each, and the two new voices, are new: see **New lines** for what to record.

| Voice | Who | Recorded by | Direction |
| --- | --- | --- | --- |
| `m1` | **Gubben** | Epidemic Sound's *Paul* | In his seventies, from Sandviken, a Brann fan for life. He has given up on the rain and is grumpy but warm about it. Slow and gravelly. |
| `m2` | **Studenten** | Epidemic Sound's *Benjamin* | In his twenties, a bit hungover, always on his way to or from a night out. Fast and casual. |
| `f1` | **Fruen** | Epidemic Sound's *Melissa* | In her late fifties, carrying bags from Fisketorget, with an opinion on everything. Brisk and a little posh. |
| `f2` | **Optimisten** | Epidemic Sound's *Annie* | In her twenties, in a raincoat, often on the phone. She thinks the sun is coming any minute now. Bright and quick. |
| `m3` | **Turisten** (new) | not yet | In his sixties, American, off a cruise ship in a poncho with a map, delighted by everything and a little lost. Loud and friendly. Speaks English. |
| `f3` | **Bestemor** (new) | not yet | In her eighties, from Nordnes, with a shopping trolley. Sharp, unimpressed and secretly fond of you. Bergensk, slow and clear. |

## When they speak

| Lines | When | |
| --- | --- | --- |
| 01–05, 14–19 | **Forbi**: you walk (or ride slowly) past | Each person decides once, as you pass closest, whether to say anything: about one in two if you brush past, less the further off you are, nothing past 4 m. One person at a time, 8 to 16 s apart |
| 06–09 | **Påkjørt**: you knock them over (running into them, a punch, a scooter, a shot) | Always |
| 10–11, 20–21 | **Sparkesykkel**: you ride past fast without hitting them | The same way as Forbi, a little likelier, with 5 to 9 s of quiet after |
| 12–13 | **Redd**: a shot goes off within 28 m | The nearest person cries out, and everyone that close hurries off for a few seconds |
| 22–23 | **Triks**: you land a trick near them | Now and then the nearest person within 14 m says something |

Only one person speaks at a time. A line cuts off a line of the same or lower priority (forbi < sparkesykkel < påkjørt and redd) and is dropped if a higher one is playing. The voice is heard in 3D, from where they stand and following them as they walk on, with your ears at your character's head, turned the way the camera looks; it gets gently quieter with distance, so a line called after you as you ride away can still be made out. The scooter radio is never turned down for them, as in real life. The words are also shown in a speech bubble for as long as the line takes to say.

## Adding or redoing recordings

Record each voice as one take, with its lines in order and a pause of about two seconds between them, then run:

```bash
python3 gtcv6/tools/build_street.py m1=paul.mp3 m2=benjamin.mp3 f1=melissa.mp3 f2=annie.mp3
```

Any voice can be redone on its own (just `f2=annie.mp3`, say). For the new lines of a voice that's already recorded, record 14–23 as one take and say where it starts: `m1@14=paul-more.mp3`. The new voices take all 23 lines in one take: `m3=tourist.mp3 f3=bestemor.mp3`. The tool levels the take as a whole, cuts it on the pauses, trims each line to 0.12 s of silence at each end, and writes 96 kbps mono MP3 (−16 LUFS, the same as the radio) to `public/audio/street/`, with `clips.json`, the list of lines and their durations that the game reads. It warns if it doesn't find the number of lines it expects in a take. Lines can also come one file each, named after their IDs (`ped_f2_06.wav`), in a folder: `python3 gtcv6/tools/build_street.py path/to/folder`.

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
| `ped_m1_14` | Eg har bodd her i sytti år, og det har aldri vært tørt en tirsdag. |
| `ped_m1_15` | Fløibanen var bedre før. Alt var bedre før. |
| `ped_m1_16` | Kjenner du Arne? Nei? Ingen kjenner Arne lenger. |
| `ped_m1_17` | Ser du måken der? Han har fulgt meg siden Torget. |
| `ped_m1_18` | Brann mot Rosenborg på søndag. Da skal eg rope. |
| `ped_m1_19` | Eg fikk ikkje vanlig kaffe. De har bare latte. |
| `ped_m1_20` | Du har ikkje førerkort på den der, vel?! |
| `ped_m1_21` | I min tid hadde syklene pedaler! |
| `ped_m1_22` | Hoho! Det der hadde ikkje eg klart. Ikkje før heller. |
| `ped_m1_23` | Bravo, gutten min. Men du kommer til å brekke noe. |

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
| `ped_m2_14` | Eg har eksamen i morgen. Eg har lest én side. |
| `ped_m2_15` | Kor e nachspielet i kveld, egentlig? |
| `ped_m2_16` | Har du sett jakken min? Eg mistet den på Kvarteret. |
| `ped_m2_17` | Eg tok Fløibanen opp og gikk ned. Ferdig med trening for i år. |
| `ped_m2_18` | Pizza på Johnny's klokka tre om natta. Det e kultur, det. |
| `ped_m2_19` | Studielånet kom i dag. Studielånet e borte i dag. |
| `ped_m2_20` | Ey! Kan eg låne den, eller? |
| `ped_m2_21` | Ka e det du kjører på, en rakett? |
| `ped_m2_22` | Yo! Gjør den igjen, eg filmer! |
| `ped_m2_23` | Det der e jo helt sjukt, kompis! |

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
| `ped_f1_14` | Reker på Fisketorget. Nitti kroner hekto. Nitti! |
| `ped_f1_15` | Eg har gått i Nordnesparken hver morgen i tjue år. Regn eller regn. |
| `ped_f1_16` | Datteren min bor i Oslo nå. Hun sier det e tørt der. Stakkars. |
| `ped_f1_17` | De har flyttet bussholdeplassen igjen. Uten å spørre meg. |
| `ped_f1_18` | Fiskesuppe på torsdag. Det e det eneste rette. |
| `ped_f1_19` | Har du sett hva et brød koster nå? Sånn ble det. |
| `ped_f1_20` | Det e fortau, ikkje motorvei! |
| `ped_f1_21` | Eg skal ringe kommunen om deg! |
| `ped_f1_22` | Nei, nå har eg sett alt. Herregud. |
| `ped_f1_23` | Moren din vet ikkje om dette, gjør hun? |

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
| `ped_f2_14` | Se, det letter! Det letter! …Nei. |
| `ped_f2_15` | Eg har kjøpt solkrem. Bare i tilfelle. |
| `ped_f2_16` | Neste uke skal det bli fint. Eg har en god følelse. |
| `ped_f2_17` | Ja, eg kommer! Eg e der om fem minutter! …Eller tjue. |
| `ped_f2_18` | Pils på Bryggen i kveld? Det e sikkert sol til da. |
| `ped_f2_19` | Eg elsker lyden av regn. Eg elsker den. Virkelig. |
| `ped_f2_20` | Ooh, kan eg sitte på? |
| `ped_f2_21` | Sånn! Ut og kjør i regnet! |
| `ped_f2_22` | Wow! Det e jo talent, det! |
| `ped_f2_23` | Eg la den ut på Instagram! Du e berømt nå! |

### `m3`: Turisten (new)

| ID | Line |
| --- | --- |
| `ped_m3_01` | Excuse me, is this the famous Bryggen? Oh. It's a car park. |
| `ped_m3_02` | Honey, take a picture of the rain! Real Norwegian rain! |
| `ped_m3_03` | We have four hours in Bergen. Where are the fjords? |
| `ped_m3_04` | Is it always this… moist? |
| `ped_m3_05` | I bought a troll. Twelve hundred kroner. Worth every penny. |
| `ped_m3_06` | Oh my God! Linda, I've been hit! |
| `ped_m3_07` | Whoa, whoa! Is that legal here? |
| `ped_m3_08` | My poncho! My brand new poncho! |
| `ped_m3_09` | Well, that's not in the brochure! |
| `ped_m3_10` | Gosh, the locals sure are in a hurry! |
| `ped_m3_11` | Hey! Is that one of those rental scooters? |
| `ped_m3_12` | Was that a gunshot? Back to the ship! Back to the ship! |
| `ped_m3_13` | Linda! Linda, get down! |
| `ped_m3_14` | Which way to the fish market? The one with the shrimp sandwiches? |
| `ped_m3_15` | They said it rains two hundred days a year. We got lucky! |
| `ped_m3_16` | Is that the mountain with the cable car, or the one with the train? |
| `ped_m3_17` | Linda says I can't buy another sweater. I'm buying another sweater. |
| `ped_m3_18` | Takk. Tack. Tuck? Did I say that right? |
| `ped_m3_19` | Everybody here is so tall. And so wet. |
| `ped_m3_20` | Yeehaw! Go get 'em, Viking! |
| `ped_m3_21` | Slow down, son, this ain't Texas! |
| `ped_m3_22` | Linda, did you get that?! Tell me you got that! |
| `ped_m3_23` | Bravo! Is this some kind of Norwegian festival? |

### `f3`: Bestemor (new)

| ID | Line |
| --- | --- |
| `ped_f3_01` | Eg har strikket fire gensere i år. Og det e bare februar. |
| `ped_f3_02` | Hjemme hos oss het det ikkje regn. Det het vær. |
| `ped_f3_03` | Kom deg i en jakke, gutt. Du blir forkjølet. |
| `ped_f3_04` | Eg har sett ni tusen cruiseskip. De ser like ut, alle sammen. |
| `ped_f3_05` | Barnebarnet mitt sier eg må på Snapchat. Eg sa nei. |
| `ped_f3_06` | Uff da! Nå datt eg! |
| `ped_f3_07` | Har du ikkje lært folkeskikk?! |
| `ped_f3_08` | Neimen, ka e det du driver med, gutten?! |
| `ped_f3_09` | Eg skal si det til moren din! |
| `ped_f3_10` | Sakte! Eg har gått her siden krigen! |
| `ped_f3_11` | Sånne ting skulle ikkje vært lov på Nordnes! |
| `ped_f3_12` | Herregud, skyting! Kom dere inn, alle sammen! |
| `ped_f3_13` | Nei, nei! Ikkje i min gate! |
| `ped_f3_14` | Vaffelrøre har eg i kjøleskapet. Hvis noen spør. |
| `ped_f3_15` | Alle skal ha havremelk nå. Ka e galt med melk? |
| `ped_f3_16` | Eg gikk opp Skivebakken i dag. To ganger. Eg e åttifire. |
| `ped_f3_17` | På lørdag e det buekorps. Da sitter eg i vinduet. |
| `ped_f3_18` | Skillingsbollen var større før. Sånn e det bare. |
| `ped_f3_19` | Pass deg for måkene. De tok luen min i fjor. |
| `ped_f3_20` | Nei, se på han! Som en villmann! |
| `ped_f3_21` | Hjelm! Har du ikkje hjelm?! |
| `ped_f3_22` | Hoi! Det minner meg om min Olav. Han var også gal. |
| `ped_f3_23` | Gjør det der en gang til, gutten, så ringer eg presten. |

## New lines

To record: lines 14–23 of `m1`, `m2`, `f1` and `f2` (40 lines, six remarks in passing, two shouts after a scooter and two cheers for a trick each), and all 23 lines of `m3` (Turisten) and `f3` (Bestemor), 86 lines in all. The kind of each line is in **When they speak**; the first number is the line's place in the take.
