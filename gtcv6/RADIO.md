# Radio Fjellet 6: chatter scripts

Scripts for the talk between the songs on the scooter radio: a DJ, station IDs, fake ads, the news, and short lines that react to what happens in the game. Generate the audio from these, send the files back named after the IDs below (for example `ad_maakeskrekk.mp3`), and they will be wired into the station.

## Recorded so far

| Clips | Voice | Status |
| --- | --- | --- |
| Song intros (5), outros (3), station IDs (4) | Epidemic Sound's *Damon* as Regnar (he reads `id_04` too) | In the game |
| News (3), reactive lines (8) | Epidemic Sound's *Alexandra* | In the game |
| DJ talk (5), ads (4) | | Waiting for audio |

All of them are levelled to −16 LUFS (the songs are about −14). Until the talk and the ads come in, their slots are left out, so the station now plays: an ID, the intro, the song, then an outro and/or the news.

The clips live in `public/audio/radio/`, named after their IDs, as 96 kbps mono MP3. `public/js/audio.js` lists the ones that exist (`TALK`, with their durations) and the reactive ones (`REACTS`). A slot without a clip is left out of the broadcast. One round of the station runs through the songs three times (about an hour), so the IDs, outros and news come round evenly.

## How it will play

The station already runs on one global clock: the songs follow each other in a fixed loop, and getting on a scooter tunes in wherever the broadcast is. The chatter goes into that same loop, between the songs, so it keeps the same behaviour. One full loop of the station:

1. Station ID, intro to *Grand Theft Cappes Vei 6*, the song, an outro, an ad
2. Station ID, intro to *Cappes Vei Six*, the song, DJ talk, the news
3. Station ID, intro to *Guangdong House*, the song, an ad, DJ talk
4. Station ID, intro to *Cappes Vei Stone and Salt*, the song, an outro, the news
5. Station ID, intro to *Cappes Vei Six (Version 2)*, the song, an ad, DJ talk

The station IDs, outros, ads, talk and news rotate, so a different one plays in each slot from loop to loop.

The **reactive lines** are different: they play over the music when something happens while you ride. The music ducks under them, as when a GTA DJ talks over a song. They play at most one every 45 seconds, and never over other talk.

## Voices

| Voice | Who | Direction |
| --- | --- | --- |
| **Regnar** | The DJ (*regn* is rain) | A Bergen DJ in his forties, warm, dry and unhurried. He has made peace with the rain and finds everything else slightly funny. Talks to one listener on a scooter, not to a crowd. |
| **Announcer** | Ads and the news | Brighter and faster: a classic ad voice for the ads, a calm newsreader for the news. Can be the same person in two modes. |
| **Customer** | One line in one ad | Anyone. |

The scripts are in English with some Norwegian, like the rest of the game. They work as well in Norwegian (Bergensk would be best). Say if you want them translated before you record.

## Audio specification

- **Format:** WAV or MP3, 44.1 or 48 kHz. The game converts everything to the same loudness and to 96 kbps mono MP3.
- **Dry voice**, no music bed. The station sits the talk between songs. Ads may have their own sound effects where the script says so.
- **Silence:** about 0.2 s of silence at each end.
- **Names:** one file per clip, named exactly after its ID.
- **Lengths:** the lengths are targets at a relaxed pace (about 150 words a minute). Shorter is fine, longer is fine within a few seconds.

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

## DJ talk (12–20 s)

**`talk_rain`** (15 s, Regnar)
> The weather. Today: rain. Tomorrow: rain. The day after, we'll see. No, we won't, it's rain. If you do see the sun today, don't look straight at it, and don't tell anyone in Oslo.

**`talk_gulls`** (14 s, Regnar)
> A word about the gulls of Fjellet. They are not your friends. They are not cute. They are organised. If one of them looks at your skillingsbolle, assume the others already know.

**`talk_shoutout`** (14 s, Regnar)
> A shout-out to Cappes vei 6, where Øystein would like whoever ate the last bolle to know that he knows. He's not angry. He's just… in the kitchen.

**`talk_scooters`** (14 s, Regnar)
> A public service announcement. The e-scooters are for one person, standing up, on the street. Not on the steps of Skivebakken. We've seen the videos. Everybody has seen the videos.

**`talk_bryggen`** (12 s, Regnar)
> Down on Bryggen the old wharf houses are leaning on each other again, which is honestly the most Bergen thing a building can do.

## Ads (20–30 s)

Fictional brands only.

**`ad_maakeskrekk`** (25 s, Announcer and Customer, sound effects)
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

**`news_maakemelding`** (18 s, Announcer as newsreader)
> And now, Måkemeldingen, the gull report. A large flock over Torget, heading inland. Fisketorget reports three stolen shrimp sandwiches and a missing baguette. If you are carrying baked goods, walk briskly and avoid eye contact.

**`news_traffic`** (17 s, Announcer as newsreader)
> Traffic. A bus is stuck on the corner of Skivebakken and Heggebakken. Again. Fjellveien is clear, if you're a mountain goat. And Kong Oscars gate is moving slowly in the rain, which is how it likes it.

**`news_party`** (15 s, Announcer as newsreader)
> In local news, residents of Cappes vei report a party expected on a terrace later tonight. The landlord has not been informed. We ask listeners not to inform the landlord.

## Reactive lines (2–8 s)

These play over the music when something happens while you ride.

| ID | Plays when | Length | Script (recorded by the second voice) |
| --- | --- | --- | --- |
| `react_alarm_high` | The Måkealarm reaches 4 | 7 s | Breaking news: an enormous flock of gulls is chasing someone through Fjellet. If that's you: keep moving. |
| `react_alarm_clear` | The Måkealarm drops back to 0 after reaching 3 or more | 3 s | Måkealarm lifted. You can come out now. |
| `react_bakery` | The scooter mission, once you're riding to the bakery on Torget | 6 s | The bakery on Torget closes in a few minutes, so if you're on your way: ride like you mean it. |
| `react_bolle` | The bolle mission, while you carry the bolle | 6 s | Word on the street is somebody's carrying the last skillingsbolle in Bergen. The gulls have heard it too. |
| `react_guangdong` | The Guangdong House mission | 4 s | Guangdong House closes at seven. Seven. Not five past. |
| `react_crash` | You crash the scooter | 2 s | Ooh. That sounded expensive. |
| `react_sun` | The rain stops for a sunny break | 5 s | Hold on… is that… the sun? Everybody outside. Quickly. It won't last. |
| `react_rain_back` | The rain comes back after a sunny break | 3 s | And it's back. Never mind. |

## All the clips

32 files in all: 4 station IDs, 5 intros, 3 outros, 5 DJ talks, 4 ads, 3 news items and 8 reactive lines. Together they come to about 5½ minutes of audio.
