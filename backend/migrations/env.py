import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Make the backend package importable when Alembic is invoked from anywhere.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from config import Config  # noqa: E402
from extensions import db  # noqa: E402

# Import every model module so all tables register on db.metadata.
import models.models  # noqa: E402,F401
import models.cms_models  # noqa: E402,F401
import models.contactus  # noqa: E402,F401
import models.testimonial_model  # noqa: E402,F401
import models.setting_model  # noqa: E402,F401
import models.analytics_model  # noqa: E402,F401

config = context.config

# Feed the runtime connection string to Alembic (escape % for configparser).
config.set_main_option(
    "sqlalchemy.url", Config.SQLALCHEMY_DATABASE_URI.replace("%", "%%")
)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = db.metadata


def _include_object(object_, name, type_, reflected, compare_to):
    # Ignore Alembic's own bookkeeping table.
    if type_ == "table" and name == "alembic_version":
        return False
    return True


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_object=_include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            include_object=_include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
