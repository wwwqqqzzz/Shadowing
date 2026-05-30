from fastapi import FastAPI, UploadFile, File, Form
import whisper
import tempfile
import os

app = FastAPI()
model = whisper.load_model("base")


@app.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form(default="en")
):
    suffix = os.path.splitext(audio.filename)[1] or ".mp3"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = model.transcribe(tmp_path, language=language)
        return {
            "text": result["text"].strip(),
            "language": language
        }
    finally:
        os.unlink(tmp_path)


@app.get("/health")
def health():
    return {"status": "ok"}
