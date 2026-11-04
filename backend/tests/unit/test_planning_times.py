from app.schemas import SolicitudIn, SolicitudUpdate
from pathlib import Path


def test_solicitud_no_asigna_duraciones_por_default() -> None:
    assert SolicitudIn.model_fields["carga_min"].default is None
    assert SolicitudIn.model_fields["descarga_min"].default is None
    assert SolicitudUpdate.model_fields["carga_min"].default is None
    assert SolicitudUpdate.model_fields["descarga_min"].default is None


def test_patch_distingue_omitir_un_tiempo_de_borrarlo() -> None:
    assert SolicitudUpdate().model_dump(exclude_unset=True) == {}
    assert SolicitudUpdate(carga_min=None).model_dump(exclude_unset=True) == {
        "carga_min": None
    }


def test_migration_reports_all_schedule_conflicts_before_mutating_rows() -> None:
    migration_path = Path(__file__).parents[2] / "sql" / "migrate_operational_availability.sql"
    migration = migration_path.read_text(encoding="utf-8").lower()

    preflight_at = migration.index("do $$")
    constraints_at = migration.index(
        "drop constraint if exists ex_solicitudes_chofer_sin_solape"
    )

    assert preflight_at < constraints_at
    assert "a.chofer_id = b.chofer_id" in migration
    assert "a.vehiculo_id = b.vehiculo_id" in migration
    assert "where rango_a && rango_b" in migration
    assert "string_agg(" in migration
    assert "detail = v_conflicts" in migration
    assert "hint = 'no se modificaron solicitudes." in migration
    assert "delete from solicitudes" not in migration
    assert "set estado =" not in migration
