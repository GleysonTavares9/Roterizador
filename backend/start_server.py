import uvicorn
import os
import multiprocessing

if __name__ == "__main__":
    # Configura o PYTHONPATH para incluir o diretório backend
    import sys
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.append(backend_dir)
    
    # Configurações do servidor
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    workers = int(os.getenv("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))
    timeout = int(os.getenv("TIMEOUT", "300"))  # 5 minutos de timeout
    
    # Inicia o servidor Uvicorn
    uvicorn.run(
        "app.fastapi_app:app",
        host=host,
        port=port,
        workers=workers,
        timeout_keep_alive=timeout,
        log_level="info",
        reload=True,  # Apenas para desenvolvimento
        limit_concurrency=1000,
        limit_max_requests=10000,
        backlog=2048,
        proxy_headers=True,
        forwarded_allow_ips="*"
    )
