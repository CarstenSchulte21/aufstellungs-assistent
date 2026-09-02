-- =============================================================================
-- Aufstellungs-Assistent · Migration 0017 — Quelle "email"
--
-- Antworten, die ein Spieler über einen Ein-Klick-Link in einer E-Mail gibt,
-- sollen im Audit-Log als solche erkennbar sein (bisher nur telegram/webapp/…).
-- =============================================================================

alter type quelle_typ add value if not exists 'email';
