module.exports = function(db, DataTypes) {
  const tableName = 'connection_protection_logs';
  
  const connection_protection_logs = db.sequelize.define(tableName, {
    id: {
			type: DataTypes.BIGINT,
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
    sso_id: {
			type: DataTypes.STRING(50),
      allowNull: false
    },
    booking_id: {
			type: DataTypes.TEXT,
      allowNull: false
    },
    request_method: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    request_url: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    request_body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    response_code: {
      type: DataTypes.STRING(3),
      allowNull: true
    },
    response_body: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    error_message: {
      type: DataTypes.TEXT,
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

  return connection_protection_logs;
};
