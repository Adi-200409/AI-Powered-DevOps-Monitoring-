import json

import pytest

from monitoring import main


def test_load_incidents_returns_empty_when_state_file_is_missing(tmp_path, monkeypatch):
    state_file = tmp_path / "nested" / "incidents.json"
    monkeypatch.setattr(main, "STATE_FILE", str(state_file))

    assert main.load_incidents() == []


def test_load_incidents_reports_corrupt_state_without_resetting_it(tmp_path, monkeypatch):
    state_file = tmp_path / "incidents.json"
    corrupted_state = "{invalid json"
    state_file.write_text(corrupted_state, encoding="utf-8")
    monkeypatch.setattr(main, "STATE_FILE", str(state_file))

    with pytest.raises(RuntimeError, match="Unable to load incident state"):
        main.save_incident({"id": "new-incident"})

    assert state_file.read_text(encoding="utf-8") == corrupted_state


@pytest.mark.parametrize("invalid_state", ['{"id": "incident"}', '[null]'])
def test_load_incidents_rejects_invalid_state_shape(tmp_path, monkeypatch, invalid_state):
    state_file = tmp_path / "incidents.json"
    state_file.write_text(invalid_state, encoding="utf-8")
    monkeypatch.setattr(main, "STATE_FILE", str(state_file))

    with pytest.raises(ValueError, match="JSON array of objects"):
        main.load_incidents()


def test_save_incident_atomically_keeps_only_the_50_most_recent(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(main, "STATE_FILE", "incidents.json")
    state_file = tmp_path / "incidents.json"
    state_file.write_text(
        json.dumps([{"id": f"incident-{index}"} for index in range(50)]),
        encoding="utf-8"
    )

    main.save_incident({"id": "new-incident"})

    incidents = json.loads(state_file.read_text(encoding="utf-8"))
    assert len(incidents) == 50
    assert incidents[0] == {"id": "new-incident"}
    assert incidents[-1] == {"id": "incident-48"}
    assert list(tmp_path.glob("*.tmp")) == []


def test_save_incident_preserves_previous_state_if_replace_fails(tmp_path, monkeypatch):
    state_file = tmp_path / "incidents.json"
    original_state = '[{"id": "existing-incident"}]'
    state_file.write_text(original_state, encoding="utf-8")
    monkeypatch.setattr(main, "STATE_FILE", str(state_file))

    def fail_replace(source, destination):
        raise OSError("simulated replace failure")

    monkeypatch.setattr(main.os, "replace", fail_replace)

    with pytest.raises(RuntimeError, match="Unable to save incident state"):
        main.save_incident({"id": "new-incident"})

    assert state_file.read_text(encoding="utf-8") == original_state
    assert list(tmp_path.glob("*.tmp")) == []
