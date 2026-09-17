const Scheduling = require("../models/Scheduling");
const User = require("../models/User");

// Create or get monthly schedule
exports.createSchedule = async (req, res) => {
  try {
    const { therapistId, childId, year, month } = req.body;

    if (!therapistId || !childId || !year || !month) {
      return res.status(400).json({
        success: false,
        message: "therapistId, childId, year and month are required.",
      });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: "Month must be between 1 and 12.",
      });
    }

    // Check therapist
    const therapist = await User.findOne({
      _id: therapistId,
      role: "Therapist",
    });

    if (!therapist) {
      return res.status(404).json({
        success: false,
        message: "Therapist not found.",
      });
    }

    // Check child
    const child = await User.findOne({
      _id: childId,
      role: "Child",
    });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: "Child not found.",
      });
    }

    // Check if schedule already exists
    let schedule = await Scheduling.findOne({
      therapistId,
      childId,
      year,
      month,
    });

    if (schedule) {
      return res.status(200).json({
        success: true,
        message: "Schedule already exists.",
        data: schedule,
      });
    }

    schedule = await Scheduling.create({
      therapistId,
      childId,
      year,
      month,
      appointments: [],
    });

    return res.status(201).json({
      success: true,
      message: "Schedule created successfully.",
      data: schedule,
    });
  } catch (error) {
    console.log("Create Schedule Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create schedule.",
      error: error.message,
    });
  }
};


// Get monthly schedule
exports.getSchedule = async (req, res) => {
    console.log("called");
  try {
    const { therapistId, childId, year, month } = req.query;

    if (!therapistId || !childId || !year || !month) {
      return res.status(400).json({
        success: false,
        message: "therapistId, childId, year and month are required.",
      });
    }

    const schedule = await Scheduling.findOne({
      therapistId,
      childId,
      year: Number(year),
      month: Number(month),
    })
      .populate("therapistId", "fullName email phone")
      .populate("childId", "fullName email phone");

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.log("Get Schedule Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get schedule.",
      error: error.message,
    });
  }
};


// Add appointment
exports.addAppointment = async (req, res) => {
  try {
    const {
      therapistId,
      childId,
      year,
      month,
      date,
      startTime,
      endTime,
    } = req.body;

    if (
      !therapistId ||
      !childId ||
      !year ||
      !month ||
      !date ||
      !startTime ||
      !endTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "therapistId, childId, year, month, date, startTime and endTime are required.",
      });
    }
    

    const schedule = await Scheduling.findOne({
      therapistId,
      childId,
      year: Number(year),
      month: Number(month),
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found. Create the schedule first.",
      });
    }

    // Check for overlapping appointments
    const requestedStart = new Date(`${date}T${startTime}:00`);
    const requestedEnd = new Date(`${date}T${endTime}:00`);

    if (requestedEnd <= requestedStart) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time.",
      });
    }

    const hasConflict = schedule.appointments.some((appointment) => {
      const appointmentStart = new Date(
        `${appointment.date.toISOString().split("T")[0]}T${appointment.startTime}:00`
      );

      const appointmentEnd = new Date(
        `${appointment.date.toISOString().split("T")[0]}T${appointment.endTime}:00`
      );

      return (
        requestedStart < appointmentEnd &&
        requestedEnd > appointmentStart
      );
    });

    if (hasConflict) {
      return res.status(409).json({
        success: false,
        message: "Appointment conflicts with an existing appointment.",
      });
    }

    const appointment = {
      id: `apt_${Date.now()}`,
      date: new Date(date),
      startTime,
      endTime,
    };

    schedule.appointments.push(appointment);

    await schedule.save();

    return res.status(201).json({
      success: true,
      message: "Appointment added successfully.",
      data: schedule,
    });
  } catch (error) {
    console.log("Add Appointment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add appointment.",
      error: error.message,
    });
  }
};


// Update appointment
exports.updateAppointment = async (req, res) => {
  try {
    const {
      therapistId,
      childId,
      year,
      month,
      appointmentId,
      date,
      startTime,
      endTime,
    } = req.body;

    if (
      !therapistId ||
      !childId ||
      !year ||
      !month ||
      !appointmentId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "therapistId, childId, year, month and appointmentId are required.",
      });
    }

    const schedule = await Scheduling.findOne({
      therapistId,
      childId,
      year: Number(year),
      month: Number(month),
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found.",
      });
    }

    const appointment = schedule.appointments.find(
      (appointment) => appointment.id === appointmentId
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    if (date) appointment.date = new Date(date);
    if (startTime) appointment.startTime = startTime;
    if (endTime) appointment.endTime = endTime;

    if (appointment.endTime <= appointment.startTime) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time.",
      });
    }

    await schedule.save();

    return res.status(200).json({
      success: true,
      message: "Appointment updated successfully.",
      data: schedule,
    });
  } catch (error) {
    console.log("Update Appointment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update appointment.",
      error: error.message,
    });
  }
};


// Delete appointment
exports.deleteAppointment = async (req, res) => {
  try {
    const {
      therapistId,
      childId,
      year,
      month,
      appointmentId,
    } = req.body;

    if (
      !therapistId ||
      !childId ||
      !year ||
      !month ||
      !appointmentId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "therapistId, childId, year, month and appointmentId are required.",
      });
    }

    const schedule = await Scheduling.findOne({
      therapistId,
      childId,
      year: Number(year),
      month: Number(month),
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found.",
      });
    }

    const appointmentExists = schedule.appointments.some(
      (appointment) => appointment.id === appointmentId
    );

    if (!appointmentExists) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    schedule.appointments = schedule.appointments.filter(
      (appointment) => appointment.id !== appointmentId
    );

    await schedule.save();

    return res.status(200).json({
      success: true,
      message: "Appointment deleted successfully.",
      data: schedule,
    });
  } catch (error) {
    console.log("Delete Appointment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete appointment.",
      error: error.message,
    });
  }
};


// Get all schedules for therapist
exports.getTherapistSchedules = async (req, res) => {
  try {
    const { therapistId, year, month } = req.query;

    if (!therapistId) {
      return res.status(400).json({
        success: false,
        message: "therapistId is required.",
      });
    }

    const filter = { therapistId };

    if (year) filter.year = Number(year);
    if (month) filter.month = Number(month);

    const schedules = await Scheduling.find(filter)
      .populate("therapistId", "fullName email phone")
      .populate("childId", "fullName email phone")
      .sort({ year: -1, month: -1 });

    return res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules,
    });
  } catch (error) {
    console.log("Get Therapist Schedules Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get therapist schedules.",
      error: error.message,
    });
  }
};


// Get all schedules for child
exports.getChildSchedules = async (req, res) => {
  try {
    const { childId, year, month } = req.query;

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "childId is required.",
      });
    }

    const filter = { childId };

    if (year) filter.year = Number(year);
    if (month) filter.month = Number(month);

    const schedules = await Scheduling.find(filter)
      .populate("therapistId", "fullName email phone")
      .populate("childId", "fullName email phone")
      .sort({ year: -1, month: -1 });

    return res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules,
    });
  } catch (error) {
    console.log("Get Child Schedules Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get child schedules.",
      error: error.message,
    });
  }
};
