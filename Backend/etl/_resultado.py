"""Contrato de salida estandarizado para que el backend (`app/routers/carga.py`)
pueda distinguir un error de datos de un error de infraestructura sin parsear
texto libre de stdout/stderr.

Cada script imprime, al finalizar, una única línea:
    ETL_RESULT_JSON:{"ok": bool, "mensaje": str, ...}
y sale con código:
    0 -> éxito (ok=True)
    2 -> error de datos (columnas faltantes, tipos inválidos, período mal
         formado, archivo no encontrado) — modelado como ValueError/
         FileNotFoundError en los scripts.
    1 -> error de infraestructura (conexión, timeout, cualquier otra
         excepción no anticipada).
"""

import json
import sys
from typing import Any, Callable


def emitir_resultado(*, ok: bool, mensaje: str, **detalle: Any) -> None:
    payload: dict[str, Any] = {"ok": ok, "mensaje": mensaje}
    if detalle:
        payload.update(detalle)
    print(f"ETL_RESULT_JSON:{json.dumps(payload, ensure_ascii=False)}")


def ejecutar(main_func: Callable[[], None]) -> None:
    """Envuelve la función `main()` de un ETL aplicando el contrato de salida
    de arriba, sin tocar su lógica de negocio."""
    try:
        main_func()
    except SystemExit:
        raise
    except (ValueError, FileNotFoundError) as exc:
        emitir_resultado(ok=False, mensaje=str(exc))
        sys.exit(2)
    except Exception as exc:  # noqa: BLE001 - último resguardo: error de infraestructura
        emitir_resultado(ok=False, mensaje=f"Error inesperado en el ETL: {exc}")
        sys.exit(1)
