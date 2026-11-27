# Radio Fjellet 6: scripts

Scripts for the talk on the scooter radio: Regnar the DJ, his co-host Sol, station IDs, fake ads and the news. It is a broadcast: it plays the same whatever you are doing in the game, and nothing on it reacts to you.

## Recorded so far

| Clips | Voice | Status |
| --- | --- | --- |
| Song intros (5), outros (3), station IDs (4) | Epidemic Sound's *Damon* as Regnar (he reads `id_04` too) | On air |
| News (3) | Epidemic Sound's *Alexandra*, who is Sol | On air |
| Conversations between songs (7), over the songs (8) | Damon as Regnar and Alexandra as Sol, one line per file | Waiting for audio |
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
| **Customer** | One line in one ad | Anyone. |

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

## Conversations between songs (30–50 s)

Regnar is **R**, Sol is **S**. Record each line as its own file, named after the conversation and the line number.

**`chat_weather`** (40 s)

| Line | | |
| --- | --- | --- |
| `chat_weather_01` | R | Time for the weather. Sol? |
| `chat_weather_02` | S | Thank you, Regnar. Today: rain, with a chance of sun this afternoon. |
| `chat_weather_03` | R | A chance. |
| `chat_weather_04` | S | A small chance. A brave chance. |
| `chat_weather_05` | R | And tomorrow? |
| `chat_weather_06` | S | Rain. The day after: rain. Saturday… I'm feeling optimistic, Regnar, so: drizzle. |
| `chat_weather_07` | R | Drizzle on a Saturday. Lovely. Anything for our listeners on scooters? |
| `chat_weather_08` | S | Wear a raincoat. And if you do see the sun, don't look straight at it. And don't tell anyone in Oslo. |

**`chat_gulls`** (40 s)

| Line | | |
| --- | --- | --- |
| `chat_gulls_01` | S | Regnar, a question from a listener. Why are the gulls in Fjellet so angry? |
| `chat_gulls_02` | R | They're not angry, Sol. They're organised. |
| `chat_gulls_03` | S | Organised. |
| `chat_gulls_04` | R | There's a hierarchy. The big one on the roof of Domkirken makes the decisions. The ones on Torget handle logistics. |
| `chat_gulls_05` | S | Logistics? |
| `chat_gulls_06` | R | Shrimp sandwiches, mostly. My advice: if one of them looks at your bolle, assume the others already know. |
| `chat_gulls_07` | S | That's not very comforting. |
| `chat_gulls_08` | R | It's not meant to be comforting. It's meant to be accurate. |

**`chat_steep`** (35 s)

| Line | | |
| --- | --- | --- |
| `chat_steep_01` | S | Did you walk to work today, Regnar? |
| `chat_steep_02` | R | I walked *up* to work today. In this town there's a difference. |
| `chat_steep_03` | S | From where? |
| `chat_steep_04` | R | Torget. Past Domkirken, up Kong Oscars gate, then Skivebakken. |
| `chat_steep_05` | S | How long did it take? |
| `chat_steep_06` | R | Twenty minutes, and one small existential crisis about halfway up. |
| `chat_steep_07` | S | Everybody has that one. It's by the green house. |
| `chat_steep_08` | R | The one with the bench. |
| `chat_steep_09` | S | The bench is there for the crisis. |

**`chat_bryggen`** (30 s)

| Line | | |
| --- | --- | --- |
| `chat_bryggen_01` | R | I was down on Bryggen today. Three cruise ships and about four thousand umbrellas. |
| `chat_bryggen_02` | S | Were they having a nice time? |
| `chat_bryggen_03` | R | They loved it. One man asked me when the rain stops. |
| `chat_bryggen_04` | S | What did you tell him? |
| `chat_bryggen_05` | R | The truth. October. |
| `chat_bryggen_06` | S | Regnar, it *is* October. |
| `chat_bryggen_07` | R | Next October. |

**`chat_scooters`** (35 s)

| Line | | |
| --- | --- | --- |
| `chat_scooters_01` | S | A public service announcement about the e-scooters. |
| `chat_scooters_02` | R | Here we go. |
| `chat_scooters_03` | S | They are for one person, standing up, on the street. |
| `chat_scooters_04` | R | Not on the steps of Skivebakken. |
| `chat_scooters_05` | S | Not on the steps of Skivebakken. We've seen the videos, Regnar. |
| `chat_scooters_06` | R | Everybody has seen the videos. Some of them were very impressive. |
| `chat_scooters_07` | S | Don't encourage them. |
| `chat_scooters_08` | R | I'm not encouraging, I'm reviewing. Seven out of ten. Work on the landing. |

**`chat_party`** (35 s)

| Line | | |
| --- | --- | --- |
| `chat_party_01` | R | Some gossip from Fjellet, Sol. |
| `chat_party_02` | S | Oh, I love gossip. |
| `chat_party_03` | R | Word is there's a party on a terrace on Cappes vei tonight. |
| `chat_party_04` | S | A terrace party. In the rain. |
| `chat_party_05` | R | And the landlord doesn't know. |
| `chat_party_06` | S | Then we should definitely not mention it on the radio. |
| `chat_party_07` | R | Absolutely not. |
| `chat_party_08` | S | So, landlord, if you're listening: nothing is happening on Cappes vei tonight. |
| `chat_party_09` | R | Nothing at all. Have a lovely evening. |

**`chat_guangdong`** (30 s)

| Line | | |
| --- | --- | --- |
| `chat_guangdong_01` | S | Regnar, what did you have for dinner yesterday? |
| `chat_guangdong_02` | R | Guangdong House. Number thirty-four. |
| `chat_guangdong_03` | S | You always have thirty-four. |
| `chat_guangdong_04` | R | I've tried the others. Thirty-four is the truth. |
| `chat_guangdong_05` | S | And what time did you get there? |
| `chat_guangdong_06` | R | Five to seven. They close at seven. |
| `chat_guangdong_07` | S | Living dangerously. |
| `chat_guangdong_08` | R | You don't understand, Sol. Five to seven is when thirty-four tastes best. |

## Over the music (10–20 s)

Short exchanges that play over a song, a little before the middle, with the music turned down under them. Quick and relaxed, as if they forgot the microphone was on.

**`over_umbrella`**

| Line | | |
| --- | --- | --- |
| `over_umbrella_01` | R | Sol, is that your umbrella in the corner? |
| `over_umbrella_02` | S | It was. Then the wind came up Kong Oscars gate. |
| `over_umbrella_03` | R | So now it's a sculpture. |
| `over_umbrella_04` | S | Modern art. Turn it up, this is the good bit. |

**`over_sunglasses`**

| Line | | |
| --- | --- | --- |
| `over_sunglasses_01` | S | Regnar, why are you wearing sunglasses? |
| `over_sunglasses_02` | R | Optimism. |
| `over_sunglasses_03` | S | It's been raining for nine days. |
| `over_sunglasses_04` | R | Ten. And when it stops, I'll be ready. |

**`over_dance`**

| Line | | |
| --- | --- | --- |
| `over_dance_01` | R | I'd like the listeners to know that Sol is dancing in the studio. |
| `over_dance_02` | S | I'm not dancing. I'm drying off. |
| `over_dance_03` | R | Rhythmically. |
| `over_dance_04` | S | Shh. Listen to the bass. |

**`over_gull`**

| Line | | |
| --- | --- | --- |
| `over_gull_01` | S | There's a gull on the window ledge again. |
| `over_gull_02` | R | The one with one leg? |
| `over_gull_03` | S | Two legs. Different gull. Same look on its face. |
| `over_gull_04` | R | Don't make eye contact. We're live. |

**`over_bolle`**

| Line | | |
| --- | --- | --- |
| `over_bolle_01` | R | Who brought skillingsboller to the studio? |
| `over_bolle_02` | S | Me. There were six. |
| `over_bolle_03` | R | There are two. |
| `over_bolle_04` | S | Then you know who ate four. Shh, here comes the chorus. |

**`over_floibanen`**

| Line | | |
| --- | --- | --- |
| `over_floibanen_01` | S | I took Fløibanen up this morning. Above the clouds: sunshine! |
| `over_floibanen_02` | R | You're making that up. |
| `over_floibanen_03` | S | Seven whole minutes of sun. Then I came back down. |
| `over_floibanen_04` | R | And now you're wet again. Welcome home. |

**`over_steps`**

| Line | | |
| --- | --- | --- |
| `over_steps_01` | R | My neighbour counted the steps from Skivebakken up to Fjellveien. |
| `over_steps_02` | S | How many? |
| `over_steps_03` | R | He doesn't know. He gave up halfway and moved to Laksevåg. |

**`over_fortyone`**

| Line | | |
| --- | --- | --- |
| `over_fortyone_01` | S | I've heard this one forty times this week. |
| `over_fortyone_02` | R | Forty-one, now. |
| `over_fortyone_03` | S | And I still like it. That's how you know it's a good song. |
| `over_fortyone_04` | R | Or that we only have five. |

## Ads (20–30 s)

Fictional brands only.

**`ad_maakeskrekk`** (25 s, Announcer and Customer, sound effects). Two voices, so it is recorded one part per file, like the conversations: `ad_maakeskrekk_01` (Customer, "They took my lunch… Again."), `ad_maakeskrekk_02` (Announcer, "Tired of feeding…" to "…forty seconds.") and `ad_maakeskrekk_03` (Announcer, fast, the tagline). The gull and the spray are added in the mix.
> **Customer:** *(miserable)* They took my lunch. *(a gull squawks)* Again.
>
> **Announcer:** Tired of feeding the gulls against your will? Introducing **Måkeskrekk**, the spray that tells a seagull: not today. One spritz around your bolle *(spray sound)* and you're protected for up to forty seconds.
>
> **Announcer:** *(fast)* Måkeskrekk. Because they're watching. Not for use on people, pets, or Martin.

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

Single clips: 4 station IDs, 5 intros, 3 outros, 4 ads and 3 news items. Conversations: 7 between the songs (57 lines) and 8 over the music (31 lines). On air so far: the IDs, intros, outros and news.
