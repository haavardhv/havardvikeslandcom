# Radio Fjellet 6: scripts

Scripts for the talk on the scooter radio: Regnar the DJ, his co-host Sol, station IDs, fake ads and the news. It is a broadcast: it plays the same whatever you are doing in the game, and nothing on it reacts to you.

## Recorded so far

| Clips | Voice | Status |
| --- | --- | --- |
| Song intros (5), outros (3), station IDs (4) | Epidemic Sound's *Damon* as Regnar (he reads `id_04` too) | On air |
| News (3) | Epidemic Sound's *Alexandra*, who is Sol | On air |
| Conversations between songs (4), over the songs (4) | Damon as Regnar and Alexandra as Sol, one line per file | Waiting for audio |
| Ads (4) | | Waiting for audio |

## Adding recordings

Put the recorded files in one folder, named after their IDs, and run:

```bash
python3 gtcv6/tools/build_radio.py path/to/recordings
```

The conversations are recorded **one line per file**, numbered in order: `chat_weather_01` (Regnar), `chat_weather_02` (Sol), and so on. The tool joins each conversation's lines into one clip with a short pause between them, levels everything to −16 LUFS, writes 96 kbps mono MP3 to `public/audio/radio/`, and updates `public/audio/radio/clips.json`, the list of clips and durations that the game reads. A clip goes on air as soon as it is in that list; a slot without one is left out.

## How it plays

The station runs on one global clock: the songs follow each other in a fixed loop, and getting on a scooter tunes in wherever the broadcast is, mid-song or mid-sentence. One full loop of the station:

1. Station ID, intro to *Grand Theft Cappes Vei 6*, the song, an outro, a conversation
2. Station ID, intro to *Cappes Vei Six*, the song, a conversation, the news
3. Station ID, intro to *Guangdong House*, the song, an ad, a conversation
4. Station ID, intro to *Cappes Vei Stone and Salt*, the song, an outro, the news
5. Station ID, intro to *Cappes Vei Six (Version 2)*, the song, a conversation, an ad

A little before the middle of every song, Regnar and Sol talk **over the music** for 10 to 20 seconds; the music ducks under them and comes back up when they're done. The IDs, outros, conversations, ads and news rotate, so a different one plays in each slot from loop to loop. One round of the station runs through the songs three times (about an hour).

## Voices

| Voice | Who | Direction |
| --- | --- | --- |
| **Regnar** (Damon) | The DJ (*regn* is rain) | A Bergen DJ in his forties, warm, dry and unhurried. He has made peace with the rain and finds everything else slightly funny. Talks to one listener on a scooter, not to a crowd. |
| **Sol** (Alexandra) | His co-host, and the news (*sol* is sun) | Quicker and brighter than Regnar, an optimist about the weather against all evidence. Teases him, laughs at him a little, and reads the news straight. |
| **Announcer** | The ads | A classic ad voice, bright and fast. |

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

Fictional brands only.

**`ad_maakeskrekk`** (25 s, Announcer, with a gull and a spray added in the mix)
> They took your lunch. *(pause)* Again. Tired of feeding the gulls against your will? Introducing **Måkeskrekk**, the spray that tells a seagull: not today. One spritz around your bolle *(pause)* and you're protected for up to forty seconds. *(fast)* Måkeskrekk. Because they're watching. Not for use on people, pets, or Martin.

**`ad_regnfrakk`** (22 s, Announcer)
> Regnfrakk-Rudolf on Strandkaien has raincoats for every kind of Bergen weather: rain, sideways rain, and rain from below. This week only: buy one raincoat and get a second raincoat, for when the first one is wet. Regnfrakk-Rudolf. It's not a fashion statement. It's survival.

**`ad_bratt`** (22 s, Announcer)
> Is your street steeper than your rent? **Bratt & Bratt Eiendom** has the flat for you. Forty-five degrees of character, a view of the neighbour's roof, and only two hundred and twelve steps from the bus stop. Bratt & Bratt. We're going up.

**`ad_sparksjo`** (20 s, Announcer)
> **SparkSjø**: e-scooters for Bergen. Up Fjellveien in four minutes. Down Fjellveien in forty seconds. Helmet sold separately. Dignity not included. SparkSjø. Just tap, and go… somewhere.

## The news (15–25 s)

**`news_maakemelding`** (18 s, Sol as newsreader)
> And now, Måkemeldingen, the gull report. A large flock over Torget, heading inland. Fisketorget reports three stolen shrimp sandwiches and a missing baguette. If you are carrying baked goods, walk briskly and avoid eye contact.

**`news_traffic`** (17 s, Sol as newsreader)
> Traffic. A bus is stuck on the corner of Skivebakken and Heggebakken. Again. Fjellveien is clear, if you're a mountain goat. And Kong Oscars gate is moving slowly in the rain, which is how it likes it.

**`news_party`** (15 s, Sol as newsreader)
> In local news, residents of Cappes vei report a party expected on a terrace later tonight. The landlord has not been informed. We ask listeners not to inform the landlord.

## All the clips

Still to record, 28 files: Regnar 12 lines, Sol 12 lines, and the 4 ads (one voice each). Already on air: 4 station IDs, 5 intros, 3 outros and 3 news items.
