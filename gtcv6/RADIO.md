# Radio Fjellet 6: scripts

Scripts for the talk on the scooter radio: Regnar the DJ, his co-host Sol, station IDs, fake ads and the news, and (new, waiting for recordings) listeners ringing in, Kåre with the traffic from an e-scooter, and a gull professor in the studio. It is a broadcast: it plays the same whatever you are doing in the game, and nothing on it reacts to you.

## Recorded so far

Everything down to **New scripts** is recorded and on air. Everything in **New scripts** is written and waiting for recordings: each clip goes on air by itself as soon as its file is in, and until then its slot is skipped.

| Clips | Voice | Notes |
| --- | --- | --- |
| Song intros (5), outros (3), station IDs (4) | Epidemic Sound's *Damon* as Regnar (he reads `id_04` too) | |
| News (3) | Epidemic Sound's *Alexandra*, who is Sol | |
| Conversations between songs (4), over the songs (4) | Damon as Regnar and Alexandra as Sol, one line per take | Cut from one long take per voice, split on the 2-second pauses |
| Ads (4) | Epidemic Sound's *Benjamin* as the announcer | Mixed over music beds from Epidemic Sound, ducked under the voice |
| Ad: *Weather by Myreze* | Supplied finished, *Gale Force Nine Mix* | A complete spot with its own voice and music; only levelled and converted |

The ads' music and sound effects, all from Epidemic Sound:

| Ad | Music | Sound effects |
| --- | --- | --- |
| `ad_maakeskrekk` | *Panda Dance*, Lukas Got Lucky | A gull from *Birds, Sea, Seagulls, Call, Weird, Hungry, Group, Loud*; *Air, Burst, Aerosol Can, Spray, Short* |
| `ad_regnfrakk` | *Summer City (Instrumental Version)*, Chasing Madison | |
| `ad_bratt` | *Moving Up*, Origo | |
| `ad_sparksjo` | *A Step Ahead*, Experia | |

## Adding recordings

Put the recorded files in one folder, named after their IDs, and run:

```bash
python3 gtcv6/tools/build_radio.py path/to/recordings
```

The conversations are recorded **one line per file**, numbered in order: `chat_weather_01` (Regnar), `chat_weather_02` (Sol), and so on. The phone-ins work the same way (`call_arne_01`, `call_arne_02`, ...): Regnar has the odd lines and the caller the even ones, and the tool puts the caller's lines through a telephone (record them clean). The tool joins each conversation's lines into one clip with a short pause between them, levels everything to −16 LUFS, writes 96 kbps mono MP3 to `public/audio/radio/`, and updates `public/audio/radio/clips.json`, the list of clips and durations that the game reads. A clip goes on air as soon as it is in that list; a slot without one is left out.

## How it plays

The station runs on one global clock: the songs follow each other in a fixed loop, and getting on a scooter tunes in wherever the broadcast is, mid-song or mid-sentence. One full loop of the station:

1. Station ID, intro to *Grand Theft Cappes Vei 6*, the song, an outro, a conversation
2. Station ID, intro to *Cappes Vei Six*, the song, a phone-in, the news
3. Station ID, intro to *Guangdong House*, the song, an ad, a conversation
4. Station ID, intro to *The Streets of Marken*, the song, the traffic with Kåre, an ad
5. Station ID, intro to *Cappes Vei Stone and Salt*, the song, an outro, the news
6. Station ID, intro to *A Little Piece of Home*, the song, a conversation, a phone-in
7. Station ID, intro to *Cappes Vei Six (Version 2)*, the song, the traffic, a conversation, an ad

A little before the middle of every song, Regnar and Sol talk **over the music** for 10 to 20 seconds; the music ducks under them and comes back up when they're done. The IDs, outros, conversations, phone-ins, traffic, ads and news rotate, so a different one plays in each slot from loop to loop. One round of the station runs through the songs three times (about an hour and a half). Until the phone-ins and the traffic are recorded, those slots are skipped.

## Voices

| Voice | Who | Direction |
| --- | --- | --- |
| **Regnar** (Damon) | The DJ (*regn* is rain) | A Bergen DJ in his forties, warm, dry and unhurried. He has made peace with the rain and finds everything else slightly funny. Talks to one listener on a scooter, not to a crowd. |
| **Sol** (Alexandra) | His co-host, and the news (*sol* is sun) | Quicker and brighter than Regnar, an optimist about the weather against all evidence. Teases him, laughs at him a little, and reads the news straight. |
| **Announcer** | The ads | A classic ad voice, bright and fast. |
| **Kåre** (new) | The traffic, from an e-scooter | In his thirties, out of breath, shouting over the wind and the motor, thrilled and a little scared. Every report is live and something is always going wrong. A little wind noise in the take is welcome. |
| **Professor Ingrid Måsøy** (new) | A guest in the studio: she studies the gulls of Bergen | In her sixties, calm, precise and very dry. Completely serious about gulls, and fond of them. |
| **Arne** (new, caller) | Arne from Sandviken | In his seventies, slow and kind, has listened forever. (Gubben's voice from the street would do.) |
| **Linda** (new, caller) | Linda from Loddefjord | In her thirties, calling from a bus, talks very fast, can't believe what she just saw. |
| **Martin** (new, caller) | Martin from Cappes vei | One of the five at Cappes vei 6, ringing in about tonight with a terrible poker face. He could record it himself. |
| **The tourist** (new, caller) | Calling from a cruise ship | American, in his sixties, cheerful and loud, on deck in the wind. (Turisten's voice from the street would do.) |

The scripts are in English with some Norwegian, like the rest of the game. They work as well in Norwegian (Bergensk would be best).

## Audio specification

- **Format:** WAV or MP3, 44.1 or 48 kHz. The tool converts everything to the same loudness and to 96 kbps mono MP3.
- **Dry voice**, no music bed. Ads may have their own sound effects where the script says so.
- **Silence:** about 0.2 s at each end of each file.
- **Names:** one file per clip (one per line for the conversations), named exactly after its ID.
- **Lengths:** the lengths are targets at a relaxed pace (about 150 words a minute). The conversations should sound like two people in a room: quick on the short replies.

## Station IDs (2–5 s)

| ID | Length | Voice | Script |
| --- | --- | --- | --- |
| `id_01` | 3 s | Regnar | Radio Fjellet 6. Det regner. Selvfølgelig. |
| `id_02` | 4 s | Regnar | You're listening to Radio Fjellet 6, broadcasting from under an umbrella. |
| `id_03` | 3 s | Regnar | Radio Fjellet 6. Hold on to your bolle. |
| `id_04` | 4 s | Announcer | Radio Fjellet 6. More rain than any other station. |

## Song intros (8–12 s)

One for each song, played just before it.

**`intro_grand-theft-cappes-vei-6`** (9 s, Regnar)
> This is the one they play when an e-scooter goes missing on Cappes vei. Coincidence? Probably not. *Grand Theft Cappes Vei 6.*

**`intro_cappes-vei-six`** (10 s, Regnar)
> Five people, one key, and a terrace with a view of everybody else's roof. This is *Cappes Vei Six.*

**`intro_guangdong-house`** (9 s, Regnar)
> It's ten to seven. You know what that means. If you're not already in the queue, this one's for you. *Guangdong House.*

**`intro_stone-and-salt`** (8 s, Regnar)
> Wet stone, sea salt, and a staircase that never ends. *Cappes Vei Stone and Salt.*

**`intro_cappes-vei-six-v2`** (10 s, Regnar)
> We liked it so much we made it longer. *Cappes Vei Six,* version two. Take the long way up Skivebakken.

## Outros (4–8 s)

Played just after a song.

| ID | Length | Script (Regnar) |
| --- | --- | --- |
| `outro_01` | 5 s | That was a long one. Like the stairs up to Fjellveien. |
| `outro_02` | 5 s | If you sang along to that, the gulls heard you. Sorry. |
| `outro_03` | 4 s | Radio Fjellet 6. Still raining. Still playing. |

## Conversations between songs (40–45 s)

Regnar is **R**, Sol is **S**. Four lines each, one file per line, named after the conversation and the line number.

**`chat_weather`** (45 s)

| Line | | |
| --- | --- | --- |
| `chat_weather_01` | R | Time for the weather, and as always I've handed it over to Sol, because I can't bring myself to say it out loud. Sol, how does it look? |
| `chat_weather_02` | S | Thank you, Regnar. Today: rain, with a small, brave chance of sun this afternoon. Tomorrow: rain. And on Saturday I'm feeling optimistic, so let's call it drizzle. |
| `chat_weather_03` | R | Drizzle on a Saturday. Lovely. Anything for our listeners out on the scooters? |
| `chat_weather_04` | S | Wear a raincoat, mind the setts on Kong Oscars gate, and if you do see the sun, don't look straight at it. And whatever you do, don't tell anyone in Oslo. |

**`chat_gulls`** (45 s)

| Line | | |
| --- | --- | --- |
| `chat_gulls_01` | S | Regnar, we've had a question from a listener. Why are the gulls in Fjellet so angry? |
| `chat_gulls_02` | R | They're not angry, Sol. They're organised. There's a hierarchy. The big one on the roof of Domkirken makes the decisions, and the ones down on Torget handle logistics. |
| `chat_gulls_03` | S | Logistics? What kind of logistics does a seagull need? |
| `chat_gulls_04` | R | Shrimp sandwiches, mostly. So my advice is this: if one of them looks at your skillingsbolle, assume the others already know. It's not meant to be comforting. It's meant to be accurate. |

**`chat_steep`** (40 s)

| Line | | |
| --- | --- | --- |
| `chat_steep_01` | S | Did you walk to work this morning, Regnar? |
| `chat_steep_02` | R | I walked *up* to work, Sol. In this town there's a difference. From Torget, past Domkirken, up Kong Oscars gate and then Skivebakken. Twenty minutes, and one small existential crisis about halfway up. |
| `chat_steep_03` | S | Everybody has that one. It's by the green house, isn't it? The one with the bench. |
| `chat_steep_04` | R | That's the one. I used to think the bench was there for the view. Now I know it's there for the crisis. |

**`chat_party`** (40 s)

| Line | | |
| --- | --- | --- |
| `chat_party_01` | R | Now, some gossip from Fjellet. Word is there's a party on a terrace on Cappes vei tonight. In the rain, of course. And I hear the landlord doesn't know. |
| `chat_party_02` | S | Oh, I love gossip. But Regnar, if the landlord doesn't know, we should definitely not be mentioning it on the radio. |
| `chat_party_03` | R | Absolutely not. I've said nothing. Nobody heard anything. |
| `chat_party_04` | S | So, landlord, if you're listening: nothing is happening on Cappes vei tonight. Nothing at all. Have a lovely evening. |

## Over the music (10–15 s)

Two lines each, played over a song a little before the middle, with the music turned down under them. Relaxed, as if they forgot the microphone was on.

**`over_umbrella`**

| Line | | |
| --- | --- | --- |
| `over_umbrella_01` | R | Sol, is that your umbrella in the corner? It looks like modern art. |
| `over_umbrella_02` | S | It was an umbrella until the wind came up Kong Oscars gate. Now it's a sculpture. Shh, turn it up, this is the good bit. |

**`over_sunglasses`**

| Line | | |
| --- | --- | --- |
| `over_sunglasses_01` | S | Regnar, why are you wearing sunglasses in the studio? It's been raining for nine days. |
| `over_sunglasses_02` | R | Ten days, Sol. And it's called optimism. When it stops, I'll be ready. |

**`over_bolle`**

| Line | | |
| --- | --- | --- |
| `over_bolle_01` | R | Who brought skillingsboller to the studio? There were six of them this morning, and now there are two. |
| `over_bolle_02` | S | That was me. And you know very well who ate the other four. Shh, here comes the chorus. |

**`over_fortyone`**

| Line | | |
| --- | --- | --- |
| `over_fortyone_01` | S | I've heard this one forty times this week, and I still like it. That's how you know it's a good song. |
| `over_fortyone_02` | R | Forty-one times now. Either it's a very good song, or we only have five. |

## Ads (20–30 s)

Fictional brands, apart from `ad_myreze`, which came finished.

**`ad_maakeskrekk`** (25 s, Announcer, with a gull and a spray added in the mix)
> They took your lunch. *(pause)* Again. Tired of feeding the gulls against your will? Introducing **Måkeskrekk**, the spray that tells a seagull: not today. One spritz around your bolle *(pause)* and you're protected for up to forty seconds. *(fast)* Måkeskrekk. Because they're watching. Not for use on people, pets, or Martin.

**`ad_regnfrakk`** (22 s, Announcer)
> Regnfrakk-Rudolf on Strandkaien has raincoats for every kind of Bergen weather: rain, sideways rain, and rain from below. This week only: buy one raincoat and get a second raincoat, for when the first one is wet. Regnfrakk-Rudolf. It's not a fashion statement. It's survival.

**`ad_bratt`** (22 s, Announcer)
> Is your street steeper than your rent? **Bratt & Bratt Eiendom** has the flat for you. Forty-five degrees of character, a view of the neighbour's roof, and only two hundred and twelve steps from the bus stop. Bratt & Bratt. We're going up.

**`ad_sparksjo`** (20 s, Announcer)
> **SparkSjø**: e-scooters for Bergen. Up Fjellveien in four minutes. Down Fjellveien in forty seconds. Helmet sold separately. Dignity not included. SparkSjø. Just tap, and go… somewhere.

**`ad_myreze`** (20 s, supplied finished)
> *Weather by Myreze*, the *Gale Force Nine Mix*: a complete spot with its own voice and music. It wasn't recorded from a script here, so there is no script for it.

## The news (15–25 s)

**`news_maakemelding`** (18 s, Sol as newsreader)
> And now, Måkemeldingen, the gull report. A large flock over Torget, heading inland. Fisketorget reports three stolen shrimp sandwiches and a missing baguette. If you are carrying baked goods, walk briskly and avoid eye contact.

**`news_traffic`** (17 s, Sol as newsreader)
> Traffic. A bus is stuck on the corner of Skivebakken and Heggebakken. Again. Fjellveien is clear, if you're a mountain goat. And Kong Oscars gate is moving slowly in the rain, which is how it likes it.

**`news_party`** (15 s, Sol as newsreader)
> In local news, residents of Cappes vei report a party expected on a terrace later tonight. The landlord has not been informed. We ask listeners not to inform the landlord.

## New scripts

Written and waiting for recordings, grouped by who reads them. Same rules as above: one file per clip, named after its ID; the conversations and phone-ins one file per line.

### New song intros (8–12 s)

**`intro_the-streets-of-marken`** (10 s, **Sol**)
> Friday night: out of the railway station, up past the bakery, and into the café that never lets you leave. Ay, qué bonito. *The Streets of Marken.*

**`intro_a-little-piece-of-home`** (11 s, Regnar)
> There's a door on Kong Oscars gate that's always a little bit open, and it always smells of bread and fire. This one's for Johnny's. *A Little Piece of Home.*

### New station IDs (2–5 s)

| ID | Length | Voice | Script |
| --- | --- | --- | --- |
| `id_05` | 3 s | Sol | Radio Fjellet 6. Sol on the radio, rain on the window. |
| `id_06` | 5 s | Regnar | Radio Fjellet 6. Two hundred and thirty days of rain a year, and every one of them live. |
| `id_07` | 4 s | Kåre | This is Kåre, on a scooter, on Radio Fjellet 6! I can't feel my hands! |
| `id_08` | 3 s | Announcer | Radio Fjellet 6. Now with forty per cent more drizzle. |

### New outros (4–8 s)

| ID | Length | Voice | Script |
| --- | --- | --- | --- |
| `outro_04` | 5 s | Sol | I'm not crying. It's the rain. Through the window. Indoors. |
| `outro_05` | 5 s | Regnar | That one was for everybody stuck behind a bus on Skivebakken. |
| `outro_06` | 5 s | Regnar | Lovely. Now somebody close the window, the studio's getting wet. |

### New conversations between songs (30–45 s)

Regnar is **R**, Sol is **S**, the professor is **P**.

**`chat_tourists`** (35 s)

| Line | | |
| --- | --- | --- |
| `chat_tourists_01` | R | Sol, three cruise ships at Skolten today. Have you been down to Bryggen? |
| `chat_tourists_02` | S | I tried. There were eleven thousand people in ponchos, all taking a picture of the same wooden house. |
| `chat_tourists_03` | R | And did anybody tell them it's raining? |
| `chat_tourists_04` | S | They know, Regnar. They paid for it. One of them asked me what time the rain stops. I said October, and he wrote it down. |

**`chat_bolle`** (35 s)

| Line | | |
| --- | --- | --- |
| `chat_bolle_01` | S | Regnar, an important question from a listener. Where's the best skillingsbolle in Bergen? |
| `chat_bolle_02` | R | Sol, I've been on the radio for nineteen years, and I have never answered that question, and I'm not starting now. People have left Bergen over that question. |
| `chat_bolle_03` | S | Just a hint. Is it near Marken? |
| `chat_bolle_04` | R | It's near a gull. That's all I'll say. Every good skillingsbolle in Bergen is near a gull. |

**`chat_buekorps`** (35 s, five lines)

| Line | | |
| --- | --- | --- |
| `chat_buekorps_01` | R | If you heard drums on Nordnes this morning, don't worry, it isn't a war. It's the buekorps. |
| `chat_buekorps_02` | S | I love the buekorps. Children with wooden crossbows, marching in the rain. Is there anything more Bergen than that? |
| `chat_buekorps_03` | R | A bus stuck on Skivebakken, maybe. Or a man telling you Brann are going to win the league. |
| `chat_buekorps_04` | S | Brann are going to win the league, Regnar. |
| `chat_buekorps_05` | R | There it is. Very Bergen. Thank you, Sol. |

**`chat_johnnys`** (35 s)

| Line | | |
| --- | --- | --- |
| `chat_johnnys_01` | S | Regnar, where do you go after the show? |
| `chat_johnnys_02` | R | Johnny's, on Kong Oscars gate. A slice and a coffee, and the man behind the counter asks how my mother is. |
| `chat_johnnys_03` | S | Does he know your mother? |
| `chat_johnnys_04` | R | No. But he asks every time, so I've started telling him. It's cheaper than therapy, and there's pizza. |

**`chat_professor`** (45 s, six lines, with the professor)

| Line | | |
| --- | --- | --- |
| `chat_professor_01` | R | In the studio today, Professor Ingrid Måsøy from the university, who has studied the gulls of Bergen for thirty years. Welcome, professor. |
| `chat_professor_02` | P | Thank you, Regnar. Thirty-one years. And they've been studying me for longer. |
| `chat_professor_03` | S | Professor, why do they always go for the skillingsbolle? |
| `chat_professor_04` | P | Cinnamon, sugar, and a person who isn't paying attention. To a gull, that's not theft. It's a gift. |
| `chat_professor_05` | R | Any advice for our listeners out on the scooters? |
| `chat_professor_06` | P | Eat indoors. Or eat fast. Or bring two boller and give one away. They remember kindness. And they remember faces. |

### New over the music (10–15 s)

**`over_window`**

| Line | | |
| --- | --- | --- |
| `over_window_01` | S | Regnar, the window's open again. |
| `over_window_02` | R | It's for the atmosphere, Sol. Listen. That's real Bergen rain, live on the radio. Shh, here's the good bit. |

**`over_gull`**

| Line | | |
| --- | --- | --- |
| `over_gull_01` | R | Sol, there's a gull on the windowsill, and it's looking at your bolle. |
| `over_gull_02` | S | Let him look. He's not getting it. Turn it up, this is my favourite part. |

**`over_dance`**

| Line | | |
| --- | --- | --- |
| `over_dance_01` | S | Are you dancing, Regnar? |
| `over_dance_02` | R | I'm nodding, Sol. In Bergen, that's dancing. |

### Phone-ins: *Ring Regnar* (25–40 s)

Regnar is **R** and has the odd lines; the caller (**C**) has the even ones, which `build_radio.py` puts through a telephone line. Record the callers clean.

**`call_arne`** (30 s, Arne from Sandviken)

| Line | | |
| --- | --- | --- |
| `call_arne_01` | R | You're on Radio Fjellet 6. Who's this? |
| `call_arne_02` | C | Hello, Regnar, it's Arne, from Sandviken. I've been listening since nineteen eighty-one. |
| `call_arne_03` | R | We started in twenty twenty, Arne. |
| `call_arne_04` | C | Well, it feels longer. I'm ringing about the rain. Is it going to stop? |
| `call_arne_05` | R | No, Arne. |
| `call_arne_06` | C | Right. Thank you. That's what I thought. Have a lovely day. |

**`call_linda`** (30 s, Linda from Loddefjord)

| Line | | |
| --- | --- | --- |
| `call_linda_01` | R | Radio Fjellet 6, you're on the air. |
| `call_linda_02` | C | Hi Regnar! It's Linda from Loddefjord! Someone just rode past my bus on an e-scooter, doing a backflip! |
| `call_linda_03` | R | A backflip, Linda? On Kong Oscars gate? |
| `call_linda_04` | C | A backflip! And then he waved! And then he went straight into a hedge, but he waved first! |
| `call_linda_05` | R | That's the spirit of Bergen, Linda. Wave first, hedge later. |

**`call_martin`** (30 s, Martin from Cappes vei)

| Line | | |
| --- | --- | --- |
| `call_martin_01` | R | Radio Fjellet 6, who's on the line? |
| `call_martin_02` | C | Hi, it's Martin, from Cappes vei. I'd like to request a song. For my landlord. |
| `call_martin_03` | R | For your landlord? What's the occasion? |
| `call_martin_04` | C | No occasion. No reason at all. Nothing is happening tonight. I just think he should stay at home and listen to the radio. All night. Very loud. |
| `call_martin_05` | R | Say no more, Martin. Landlord, this next one's for you. Stay right where you are. |

**`call_tourist`** (35 s, from a cruise ship)

| Line | | |
| --- | --- | --- |
| `call_tourist_01` | R | You're on Radio Fjellet 6. |
| `call_tourist_02` | C | Hi, yes, hello! I'm calling from the cruise ship! We're up on deck, and we'd like to know: when is the sun scheduled? |
| `call_tourist_03` | R | Scheduled? |
| `call_tourist_04` | C | The brochure said Bergen has sunshine. We've got three hours left. |
| `call_tourist_05` | R | Sir, I'll be honest with you. Buy an umbrella on Torget, eat a fish cake, and wave at Fløyen. That's the sunshine. That's the whole show. |

### The traffic, with Kåre (10–15 s)

Single clips, read live from a moving scooter.

| ID | Length | Script (Kåre) |
| --- | --- | --- |
| `traffic_01` | 12 s | Kåre here, on the scooter, on Fjellveien! Fjellveien is clear! Fjellveien is very, very steep! I have no brakes! Back to you, Regnar! |
| `traffic_02` | 13 s | Kåre on Kong Oscars gate! The bus is stuck on Skivebakken again, the queue goes back to Domkirken, and a gull is directing the traffic. He's doing better than the lights! |
| `traffic_03` | 11 s | Kåre at Bryggen! Three cruise ships, nine thousand people, one zebra crossing! If you're in a hurry, don't be! Kåre, out! |
| `traffic_04` | 11 s | Kåre on Marken! It's cobbles, it's wet, and I'm upside down! The traffic's moving fine! I'm not! Back to the studio! |

### New ads (15–25 s, Announcer)

Fictional brands, like the others. Music beds as for the old ones are welcome but not needed.

**`ad_fjellgeit`** (18 s)
> **Fjellgeit Sko**: the shoe for Bergen's steepest streets. Grip on wet setts. Grip on wet stairs. Grip on the wet bolle you just dropped on the wet stairs. Fjellgeit. For people who live uphill, which is everybody.

**`ad_tork`** (18 s)
> Wet again? **Tørk** is Bergen's first drying service by subscription. We come to your door, take your wet clothes away, and bring them back almost dry. Tørk. Almost is a start.

**`ad_regnlotto`** (16 s)
> Play **Regnlotto**! Guess how many days in a row it will rain, and win! Last week's winning number: all of them. Regnlotto. Everybody wins. Nobody's dry.

### New news (12–20 s, Sol as newsreader)

**`news_cruise`** (13 s)
> Three cruise ships are in Bergen today, with nine thousand passengers and four thousand ponchos. The rain has been asked to carry on as normal.

**`news_floibanen`** (13 s)
> Fløibanen reports record numbers today. Four hundred people went up to Fløyen to look at the view, and four hundred people came back down to say there wasn't one.

**`news_brann`** (13 s)
> Sport. Brann won on Sunday, and Sandviken has been singing ever since. Police ask residents to keep the noise down, starting, they say, at the weekend. Maybe.

**`news_bolle`** (13 s)
> Fears for the skillingsboller tonight, after a gang of gulls was seen over Marken. Bakeries are asked to keep their doors shut and their trays well inside.

## All the clips

On air now, 28 clips: 4 station IDs, 5 intros, 3 outros, 3 news items, 5 ads, 4 conversations between songs and 4 over the music.

New, to record, 37 clips: 2 intros (for *The Streets of Marken* and *A Little Piece of Home*), 4 station IDs, 3 outros, 5 conversations (one with the gull professor), 3 over the music, 4 phone-ins, 4 traffic reports, 3 ads and 4 news items. By voice: Regnar has lines in nearly all of them; Sol has `intro_the-streets-of-marken`, `id_05`, `outro_04`, the news and her half of the conversations; the announcer has `id_08` and the ads; Kåre has `id_07` and the traffic; and the professor and the four callers have their own.
