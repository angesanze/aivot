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
  description = "URL pubblico dell'APP (app.<dominio> se c'è un dominio custom, altrimenti il sito Firebase dell'app). Vuoto se Firebase è disattivato."
}

output "marketing_url" {
  value       = local.marketing_url
  description = "URL pubblico della VETRINA marketing (l'apex <dominio> se c'è un dominio custom, altrimenti il suo sito Firebase)."
}

output "firebase_site_id" {
  value       = var.enable_firebase ? google_firebase_hosting_site.frontend[0].site_id : ""
  description = "ID del sito Firebase Hosting dell'APP (frontend SPA su app.<dominio>)."
}

output "firebase_marketing_site_id" {
  value       = var.enable_firebase ? google_firebase_hosting_site.marketing[0].site_id : ""
  description = "ID del sito Firebase Hosting della VETRINA (marketing/dist sull'apex <dominio>)."
}

output "artifact_repo" {
  value       = "${var.region}-docker.pkg.dev/${local.project_id}/${google_artifact_registry_repository.containers.repository_id}"
  description = "Percorso Artifact Registry dove pubblicare l'immagine del backend."
}

output "db_connection_name" {
  value       = google_sql_database_instance.pg.connection_name
  description = "Connection name dell'istanza Cloud SQL."
}
