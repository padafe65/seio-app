-- Ejecutar una sola vez en MySQL/MariaDB para crear la base aislada.
-- No elimina ni modifica seio_db. Fallará si seio_db_pruebas ya existe.
CREATE DATABASE seio_db_pruebas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE seio_db_pruebas;
