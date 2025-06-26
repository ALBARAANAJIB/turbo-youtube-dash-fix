# File: backend/scripts/script.py
import sys
from youtube_transcript_api import YouTubeTranscriptApi # Corrected capitalization

def get_transcript(video_id):
    try:
        # Fetch transcript as a list of dictionaries with 'text' and 'start'
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        
        # Join all text entries into a single string, separated by spaces
        full_text = " ".join([entry['text'] for entry in transcript_list])
        
        # Print the full text to standard output for Node.js to capture
        print(full_text)
        
    except Exception as e:
        # Print error messages to standard error (stderr)
        # This allows Node.js to differentiate between a successful output and an error
        print(f"Error fetching transcript for video ID {video_id}: {e}", file=sys.stderr)
        # Exit with a non-zero status code to indicate an error to the calling Node.js process
        sys.exit(1)

if __name__ == "__main__":
    # Check if a video ID was provided as a command-line argument
    if len(sys.argv) < 2:
        print("Usage: python script.py <video_id>", file=sys.stderr)
        sys.exit(1)
        
    video_id = sys.argv[1] # Get the video ID from the first command-line argument
    get_transcript(video_id)