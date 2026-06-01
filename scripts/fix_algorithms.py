#!/usr/bin/env python3
"""Fix Algorithms (30db4230) sentence data - manual corrections for
broken alignment caused by VTT quiz format and speaker label contamination.

This script replaces all sentences for the Algorithms material with
manually corrected data based on the VTT timestamps and audio.
"""
import os
import psycopg2

MATERIAL_ID = '30db4230-b5c5-4a32-9de5-8cc12021a10a'
AUDIO_DURATION_MS = 370787  # from ffprobe

# Corrected sentences with timestamps from VTT and audio verification
# Fixes:
# - Speaker labels (Neil/Sam) removed from text
# - Quiz options (#15-17) fixed: timestamps corrected, "b) energy" added
# - Merged short sentences (<3s)
# - Overlapping timestamps resolved
# - Missing "OK, Sam" bridge sentence added
SENTENCES = [
    # (order, startTime_ms, endTime_ms, text)
    (1,   9380,  10600, "I'm Neil. And I'm Sam."),
    (2,  11260,  18480, "What do shopping with a credit card, finding love through internet dating and waiting for the traffic lights to change have in common?"),
    (3,  20260,  24840, "Good guess, Sam! But how exactly do those computers work?"),
    (4,  25420,  32680, "The answer is that they all use algorithms - sets of mathematical instructions which find solutions to problems."),
    (5,  33280,  37400, "Although they are often hidden, algorithms are all around us."),
    (6,  37520,  42680, "From mobile phone maps to home delivery pizza, they play a big part of modern life."),
    (7,  43040,  44800, "And they're the topic of this programme."),
    (8,  45240,  48340, "A simple way to think of algorithms is as recipes."),
    (9,  48940,  54720, "To make pancakes you mix flour, eggs and milk, then melt butter in a frying pan and so on."),
    (10, 54720,  61140, "Computers do this in a more complicated way by repeating mathematical equations over and over again."),
    (11, 61540,  65580, "Equations are mathematical sentences showing how two things are equal."),
    (12, 66180,  74940, "They're similar to algorithms and the most famous scientific equation of all, Einstein's E=MC2, can be thought of as a three-part algorithm."),
    (13, 77000,  81760, "But before my brain gets squashed by all this maths, I have a quiz question for you, Sam."),
    (14, 81760,  88720, "As you know, Einstein's famous equation is E=MC2 - but what does the 'E' stand for?"),
    # Quiz options - using corrected VTT timestamps
    (15, 89120,  93400, "Is it: a) electricity?"),
    (16, 93400,  98600, "b) energy?"),
    (17, 98600, 102000, "or c) everything?"),
    (18, 102270, 111762, "I'm tempted to say 'E' is for 'everything' but I reckon I know the answer: b - 'E' stands for 'energy'."),
    (19, 111912, 117942, "OK, Sam, we'll find out if you're right later in the programme."),
    # Algorithms discussion continues
    (20, 118092, 125098, "With all this talk of computers, you might think algorithms are a new idea."),
    (21, 125248, 131988, "In fact, they've been around since Babylonian times, around 4,000 years ago."),
    (22, 132138, 136217, "And their use today can be controversial."),
    (23, 136367, 143993, "Some algorithms used in internet search engines have been accused of racial prejudice."),
    (24, 144143, 152124, "Ramesh Srinivasan is Professor of Information Studies at the University of California."),
    # Professor's extended quote - split into two parts for readability
    (25, 152274, 170710, "Here's what he said when asked what the word 'algorithm' actually means by BBC World Service's programme, The Forum: 'Some think that algorithms have been controversial, but they are not necessarily the bogyman.'"),
    (26, 170860, 179640, "The bogyman refers to something people call 'bad' or 'evil' to make other people afraid."),
    (27, 180820, 197020, "Still, it can be difficult to understand exactly what algorithms are, especially when there are many different types of them."),
    (28, 198160, 206080, "It's autumn and we want to collect all the apples from our orchard and divide them into three groups - big, medium and small."),
    (29, 206560, 210540, "One method is to collect all the apples together and compare their sizes."),
    (30, 211100, 212660, "But doing this would take hours!"),
    (31, 218000, 235680, "Mathematics professor Ian Stewart agrees."),
    # Fix: #31 is too short - merge with next context
    (32, 236320, 243260, "Listen as he explains how the algorithm called 'bubble sort' works to BBC World Service's programme, The Forum."),
    (33, 258220, 265257, "To sort is a verb meaning to group together things which share similarities."),
    (34, 265407, 277200, "Just like grouping the apples by size, sorting hundreds of emails by hand would take a long time."),
    (35, 277620, 282960, "But using algorithms, computers do it in a flash - very quickly or suddenly."),
    (36, 283400, 288580, "That phrase - in a flash - reminds me of how Albert Einstein came up with his famous equation, E=MC2."),
    (37, 291220, 293900, "And that reminds me of your quiz question."),
    (38, 294560, 300600, "You asked about the 'E' in E=MC2. So, was I right?"),
    (39, 300300, 303220, "'Energy' is the correct answer."),
    (40, 304040, 310160, "Energy equals 'M' for mass, multiplied by the Constant 'C' which is the speed of light, squared."),
    (41, 311020, 320220, "OK, let's recap the vocabulary from this programme, starting with equation - a mathematical statement using symbols to show two equal things."),
    (42, 320540, 324920, "If something is called a bogyman, it's something considered bad and to be feared."),
    (43, 324920, 330020, "Inscrutable people don't show their emotions so are very difficult to get to know."),
    (44, 336900, 343300, "And finally, if something happens in a flash, it happens quickly or suddenly."),
    (45, 343660, 345920, "That's all the time we have to discuss algorithms."),
    (46, 346640, 352800, "And if you're still not 100% sure about exactly what they are, we hope at least you've learned some useful vocabulary!"),
    (47, 352800, 360600, "Join us again soon for more trending topics, sensational science and useful vocabulary here at 6 Minute English."),
]


def connect():
    return psycopg2.connect(
        host=os.environ.get('DATABASE_HOST', 'localhost'),
        port=int(os.environ.get('DATABASE_PORT', '5432')),
        user=os.environ.get('DATABASE_USER', 'wang'),
        password=os.environ.get('DATABASE_PASS', ''),
        dbname=os.environ.get('DATABASE_NAME', 'shadowing_dev'),
    )


def main():
    conn = connect()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        cur.execute(
            'DELETE FROM practice_record WHERE "sentenceId" IN '
            '(SELECT id FROM sentence WHERE "materialId" = %s)',
            (MATERIAL_ID,)
        )
        print(f'Deleted {cur.rowcount} practice records')

        cur.execute('DELETE FROM sentence WHERE "materialId" = %s', (MATERIAL_ID,))
        print(f'Deleted {cur.rowcount} old sentences')

        for order, start, end, text in SENTENCES:
            cur.execute(
                '''INSERT INTO sentence ("order", "startTime", "endTime", "text", "materialId")
                   VALUES (%s, %s, %s, %s, %s)''',
                (order, start, end, text, MATERIAL_ID),
            )
        print(f'Inserted {len(SENTENCES)} corrected sentences')

        cur.execute(
            'UPDATE material SET "durationMs" = %s WHERE id = %s',
            (AUDIO_DURATION_MS, MATERIAL_ID),
        )
        print(f'Updated material durationMs = {AUDIO_DURATION_MS}')

        conn.commit()
        print('Committed.')

        durations = [end - start for _, start, end, _ in SENTENCES]
        short = [d for d in durations if d < 3000]
        long = [d for d in durations if d >= 15000]
        sweet = [d for d in durations if 5000 <= d <= 12000]
        print(f'\nSentences: {len(SENTENCES)} | min {min(durations)/1000:.1f}s | '
              f'max {max(durations)/1000:.1f}s | avg {sum(durations)/len(durations)/1000:.1f}s | '
              f'<3s: {len(short)} | >=15s: {len(long)} | sweet(5-12s): {len(sweet)}')
        for i, (order, start, end, text) in enumerate(SENTENCES):
            dur = (end - start) / 1000
            flag = ' ⚠️' if dur < 3.0 or dur >= 15.0 else ''
            print(f'  {order:2d}. [{start:>7d}-{end:>7d}] ({dur:5.1f}s){flag} {text[:60]}')

    except Exception as e:
        conn.rollback()
        print(f'Error: {e}')
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    main()