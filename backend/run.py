import uvicorn

if __name__ == "__main__":
    print("Starting SpendLens Backend Server...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8080, reload=True)
