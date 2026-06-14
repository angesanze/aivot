output "project_id" {
  value       = local.project_id
  description = "ID del progetto usato/creato."
}

output "backend_url" {
  value       = google_cloud_run_v2_service.backend.uri
  description = "URL pubblico del backend Cloud Run. deploy.sh lo rilegge e lo ripassa come service_url al secondo apply."
}

output "frontend_url" {
  value       = local.frontend_url
  description = "URL del frontend su Firebase Hosting (vuoto se Firebase è disattivato)."
}

output "firebase_site_id" {
  value       = var.enable_firebase ? google_firebase_hosting_site.frontend[0].site_id : ""
  description = "ID del sito Firebase Hosting su cui pubblicare il frontend."
}

output "artifact_repo" {
  value       = "${var.region}-docker.pkg.dev/${local.project_id}/${google_artifact_registry_repository.containers.repository_id}"
  description = "Percorso Artifact Registry dove pubblicare l'immagine del backend."
}

output "db_connection_name" {
  value       = google_sql_database_instance.pg.connection_name
  description = "Connection name dell'istanza Cloud SQL."
}
