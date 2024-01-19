module.exports = function(db, DataTypes, tableName) {
  const logs = db.sequelize.define(tableName, {
    id: {
			type: DataTypes.BIGINT,
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
    level: {
			type: DataTypes.STRING(5),
			allowNull: false
		},
    component: {
			type: DataTypes.STRING(100),
			allowNull: false
		},
    context: {
			type: DataTypes.STRING(100),
			allowNull: false
		},
    agency_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    agency_program_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    error_code: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sso_id: {
			type: DataTypes.STRING(50),
      allowNull: true
    },
    request_method: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    request_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    request_body: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    response_code: {
      type: DataTypes.STRING(3),
      allowNull: true
    },
    response_body: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sql: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    data: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    stack: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    elapsed_time: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    timestamp: {
      type: DataTypes.DATE_NO_TZ,
			allowNull: false,
			defaultValue: db.GET_CURRENT_TIMESTAMP(),
      get() {
        return db.formatDate(this.getDataValue('timestamp'));
      }
		}
	}, db.setOptions({
		tableName
  }));

  return logs;
};
