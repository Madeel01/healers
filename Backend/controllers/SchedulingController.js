const Scheduling = require("../models/Scheduling");
const User = require("../models/User");

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

    const therapist = await User.findOne({
      _id: therapistId,
      role: "Therapist",
    });

    if (!therapist) {
      return res.json({
        success: false,
        message: "Therapist not found.",
      });
    }

    const child = await User.findOne({
      _id: childId,
      role: "Child",
    });

    if (!child) {
      return res.json({
        success: false,
        message: "Child not found.",
      });
    }

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
      return res.json({
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

    const numericYear = Number(year);
    const numericMonth = Number(month);

    if (numericMonth < 1 || numericMonth > 12) {
      return res.status(400).json({
        success: false,
        message: "Month must be between 1 and 12.",
      });
    }

    const requestedStart = new Date(`${date}T${startTime}:00`);
    const requestedEnd = new Date(`${date}T${endTime}:00`);

    if (
      Number.isNaN(requestedStart.getTime()) ||
      Number.isNaN(requestedEnd.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date or time format.",
      });
    }

    if (requestedEnd <= requestedStart) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time.",
      });
    }

    const schedule = await Scheduling.findOne({
      therapistId,
      childId,
      year: numericYear,
      month: numericMonth,
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found. Create the schedule first.",
      });
    }

    const sameTherapistAppointments = schedule.appointments.filter(
      (appointment) => {
        const appointmentDate = new Date(appointment.date);

        return (
          appointmentDate.getFullYear() === requestedStart.getFullYear() &&
          appointmentDate.getMonth() === requestedStart.getMonth() &&
          appointmentDate.getDate() === requestedStart.getDate()
        );
      }
    );

    if (sameTherapistAppointments.length >= 2) {
      return res.status(409).json({
        success: false,
        message:
          "This child already has the maximum of 2 appointments with this therapist on this day.",
      });
    }

    const sameTherapistConflict = sameTherapistAppointments.some(
      (appointment) => {
        const appointmentDate = new Date(appointment.date);

        const appointmentStart = new Date(
          `${appointmentDate.toISOString().split("T")[0]}T${appointment.startTime}:00`
        );

        const appointmentEnd = new Date(
          `${appointmentDate.toISOString().split("T")[0]}T${appointment.endTime}:00`
        );

        return (
          requestedStart < appointmentEnd &&
          requestedEnd > appointmentStart
        );
      }
    );

    if (sameTherapistConflict) {
      return res.status(409).json({
        success: false,
        message:
          "This appointment conflicts with another appointment for the same therapist.",
      });
    }

    const childSchedules = await Scheduling.find({
      childId,
      year: numericYear,
      month: numericMonth,
    });

    for (const childSchedule of childSchedules) {
      for (const appointment of childSchedule.appointments) {
        const appointmentDate = new Date(appointment.date);

        const appointmentDateString =
          appointmentDate.toISOString().split("T")[0];

        if (appointmentDateString !== date) {
          continue;
        }

        if (
          childSchedule.therapistId.toString() ===
          therapistId.toString()
        ) {
          continue;
        }

        const existingStart = new Date(
          `${appointmentDateString}T${appointment.startTime}:00`
        );

        const existingEnd = new Date(
          `${appointmentDateString}T${appointment.endTime}:00`
        );

        const hasConflict =
          requestedStart < existingEnd &&
          requestedEnd > existingStart;

        if (hasConflict) {
          return res.status(409).json({
            success: false,
            message:
              "This child already has an appointment with another therapist during this time.",
          });
        }
      }
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

    const numericYear = Number(year);
    const numericMonth = Number(month);

    if (numericMonth < 1 || numericMonth > 12) {
      return res.status(400).json({
        success: false,
        message: "Month must be between 1 and 12.",
      });
    }

    const schedule = await Scheduling.findOne({
      therapistId,
      childId,
      year: numericYear,
      month: numericMonth,
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

    const newDate = date
      ? date
      : new Date(appointment.date).toISOString().split("T")[0];

    const newStartTime = startTime || appointment.startTime;
    const newEndTime = endTime || appointment.endTime;

    const requestedStart = new Date(
      `${newDate}T${newStartTime}:00`
    );

    const requestedEnd = new Date(
      `${newDate}T${newEndTime}:00`
    );

    if (
      Number.isNaN(requestedStart.getTime()) ||
      Number.isNaN(requestedEnd.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date or time format.",
      });
    }

    if (requestedEnd <= requestedStart) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time.",
      });
    }

    const childSchedules = await Scheduling.find({
      childId,
      year: numericYear,
      month: numericMonth,
    });

    let sameTherapistAppointmentsOnDay = [];

    for (const childSchedule of childSchedules) {
      if (
        childSchedule.therapistId.toString() !==
        therapistId.toString()
      ) {
        continue;
      }

      for (const existingAppointment of childSchedule.appointments) {
        if (existingAppointment.id === appointmentId) {
          continue;
        }

        const existingDate = new Date(existingAppointment.date);

        const existingDateString =
          existingDate.toISOString().split("T")[0];

        if (existingDateString === newDate) {
          sameTherapistAppointmentsOnDay.push(
            existingAppointment
          );
        }
      }
    }

    if (sameTherapistAppointmentsOnDay.length >= 2) {
      return res.status(409).json({
        success: false,
        message:
          "This child already has the maximum of 2 appointments with this therapist on this day.",
      });
    }

    const sameTherapistConflict =
      sameTherapistAppointmentsOnDay.some(
        (existingAppointment) => {
          const existingDate = new Date(
            existingAppointment.date
          );

          const existingDateString =
            existingDate.toISOString().split("T")[0];

          const existingStart = new Date(
            `${existingDateString}T${existingAppointment.startTime}:00`
          );

          const existingEnd = new Date(
            `${existingDateString}T${existingAppointment.endTime}:00`
          );

          return (
            requestedStart < existingEnd &&
            requestedEnd > existingStart
          );
        }
      );

    if (sameTherapistConflict) {
      return res.status(409).json({
        success: false,
        message:
          "This appointment conflicts with another appointment for the same therapist.",
      });
    }

    for (const childSchedule of childSchedules) {
      if (
        childSchedule.therapistId.toString() ===
        therapistId.toString()
      ) {
        continue;
      }

      for (const existingAppointment of childSchedule.appointments) {
        const existingDate = new Date(existingAppointment.date);

        const existingDateString =
          existingDate.toISOString().split("T")[0];

        if (existingDateString !== newDate) {
          continue;
        }

        const existingStart = new Date(
          `${existingDateString}T${existingAppointment.startTime}:00`
        );

        const existingEnd = new Date(
          `${existingDateString}T${existingAppointment.endTime}:00`
        );

        const hasConflict =
          requestedStart < existingEnd &&
          requestedEnd > existingStart;

        if (hasConflict) {
          return res.status(409).json({
            success: false,
            message:
              "This child already has an appointment with another therapist during this time.",
          });
        }
      }
    }

    appointment.date = new Date(newDate);
    appointment.startTime = newStartTime;
    appointment.endTime = newEndTime;

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
      return res.json({
        success: false,
        message: "Schedule not found.",
      });
    }

    const appointmentExists = schedule.appointments.some(
      (appointment) => appointment.id === appointmentId
    );

    if (!appointmentExists) {
      return res.json({
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


exports.getTherapistSchedules = async (req, res) => {
  try {
    const { therapistId, year, month, search } = req.query;

    const filter = {};
    if (therapistId) filter.therapistId = therapistId;
    if (year) filter.year = Number(year);
    if (month) filter.month = Number(month);

    let schedules = await Scheduling.find(filter)
      .populate("therapistId", "fullName email phone")
      .populate("childId", "fullName email phone")
      .sort({ year: -1, month: -1 });

    if (search && search.trim()) {
      const query = search.trim().toLowerCase();

      const monthNames = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
      ];

      schedules = schedules.filter((s) => {
        const therapistName = s.therapistId?.fullName?.toLowerCase() || "";
        const childName = s.childId?.fullName?.toLowerCase() || "";
        const matchName = therapistName.includes(query) || childName.includes(query);

        const matchYear = String(s.year).includes(query);

        const currentMonthName = monthNames[s.month - 1] || "";
        const matchMonthNumber = String(s.month) === query || String(s.month).padStart(2, "0") === query;
        const matchMonthName = currentMonthName.includes(query);
        const matchMonth = matchMonthNumber || matchMonthName;

        const matchTime = (s.appointments || []).some((apt) => {
          const startTime = (apt.startTime || "").toLowerCase();
          const endTime = (apt.endTime || "").toLowerCase();
          return startTime.includes(query) || endTime.includes(query);
        });

        return matchName || matchYear || matchMonth || matchTime;
      });
    }

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
