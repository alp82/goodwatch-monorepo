import json
import requests


def create_embedding(texts: list[str]):
    #model_name = "sentence-transformers/all-MiniLM-L6-v2"
    model_name = "BAAI/bge-m3"
    result = requests.post(
        "http://157.90.157.44:7997/embeddings",
        json={
            "model": model_name,
            "input": texts
        }
    ).json()
    print(result)

    return [item["embedding"] for item in result["data"]]


def main():
    dna1 = {
        "Flag": [
            "Graphic Violence",
            "Strong Language",
            "Disturbing Images"
        ],
        "Mood": [
            "Intense",
            "Gritty",
            "Suspenseful",
            "Dark",
            "Serious",
            "Investigative",
            "Anxious"
        ],
        "Plot": [
            "Criminal Profiling",
            "High-Stakes Investigations",
            "Unraveling Mysteries",
            "Serial Killer Pursuit",
            "Internal Conflicts",
            "Interagency Rivalry",
            "Crime Scene Analysis",
            "Ethical Dilemmas"
        ],
        "Time": [
            "Present Day"
        ],
        "Place": [
            "Urban Cityscape",
            "Criminal Underworld"
        ],
        "Themes": [
            "Teamwork",
            "Justice",
            "Betrayal",
            "Redemption",
            "The Human Condition"
        ],
        "Key Props": [
            "Profiling Tools",
            "Evidence Files",
            "Crime Scene Photos"
        ],
        "Sub-Genres": [
            "Crime Thriller",
            "Buddy Cop"
        ],
        "Dialog Style": [
            "Technical Jargon",
            "Fast-Paced Exchanges"
        ],
        "Character Types": [
            "Profiler",
            "Rookie",
            "Veteran",
            "Leader",
            "Outcast"
        ],
        "Cinematic Style": [
            "Handheld Camera Work",
            "High Contrast Lighting",
            "Pov Shots"
        ],
        "Target Audience": [
            "Adults",
            "Crime Drama Enthusiasts"
        ],
        "Narrative Structure": [
            "Episodic Structure",
            "Flashbacks"
        ],
        "Costume and Set Design": [
            "Modern Attire",
            "Crime Scene Sets"
        ],
        "Score and Sound Design": [
            "Electronic Music",
            "Ambient Sounds",
            "Sound Effects Emphasis"
        ]
    }

    dna2 = {
        "Mood": [
            "Emotional",
            "Heartwarming",
            "Intimate",
            "Sentimental",
            "Heart-Wrenching"
        ],
        "Plot": [
            "Family Secrets",
            "Parent-Child Relationships",
            "Reconciliation",
            "Overcoming Trauma",
            "Personal Growth",
            "Emotional Revelations",
            "Generational Conflicts",
            "Past Reconciliation"
        ],
        "Time": [
            "Present Day"
        ],
        "Place": [
            "Suburban Neighborhood"
        ],
        "Themes": [
            "Family Bonds",
            "Coming Of Age",
            "Self-Discovery",
            "Redemption"
        ],
        "Sub-Genres": [
            "Family Drama",
            "Coming-Of-Age Drama"
        ],
        "Cinematic Style": [
            "Emotional Close-Ups",
            "Handheld Camera Work"
        ],
        "Target Audience": [
            "Adults"
        ],
        "Costume and Set Design": [
            "Modern Attire",
            "Suburban Homes"
        ],
        "Score and Sound Design": [
            "Orchestral Score",
            "Diegetic Music"
        ]
    }

    return create_embedding(texts=[
        json.dumps(dna1),
        #json.dumps(dna2),
    ])
