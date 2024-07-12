# Use the official Python image from the Docker Hub
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /chatbot-backend

# Copy the requirements file into the container
COPY requirements.txt requirements.txt

CMD ["sudo", "apt-get", "install", "build-essential"]

CMD ["sudo", "apt-get", "install", "gcc-11", "g++-11"]

RUN pip install --upgrade setuptools wheel
RUN pip install uvicorn fastapi

CMD ["CMAKE_ARGS="-DLLAMA_OPENBLAS=on"", "FORCE_CMAKE=1", "pip", "install", "-r" , "requirements.txt"]
# Install the required packages
CMD ["CXX=g++-11", "CC=gcc-11", "pip", "install", "-r" , "requirements.txt"]
# Copy the rest of the application code into the container
COPY . .
# CMD ["uvicorn", "--version"]
# CMD ["echo", "$PATH"]
# CMD ["export", "PATH=$PATH:~/.local/bin"]
# CMD ["source", "~/.bashrc"]
# Command to run the FastAPI app using uvicorn
CMD ["uvicorn", "reactTest:app"]
