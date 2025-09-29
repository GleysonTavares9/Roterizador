from setuptools import setup, find_packages

setup(
    name="sistema_roteirizacao",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi>=0.95.2",
        "uvicorn>=0.22.0",
        "sqlalchemy>=2.0.23",
        "python-dotenv>=1.0.0",
        "python-multipart>=0.0.6",
        "passlib[bcrypt]>=1.7.4",
        "python-jose[cryptography]>=3.3.0",
        "geopy>=2.4.1",
        "requests>=2.31.0",
        "ortools>=9.6.0",
    ],
)
