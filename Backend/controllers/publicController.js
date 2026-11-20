const { default: mongoose } = require("mongoose");
const TherapistAssignment = require("../models/TherapistAssignment");
const User = require("../models/User");
const Service = require("../models/Service");
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");



exports.getDoctorPublic = async (req, res) => {
  try {
    const { specialties } = req.body;

    if (
      !specialties ||
      (Array.isArray(specialties) && !specialties.length)
    ) {
      return res.status(400).json({
        success: false,
        message: "Specialties are required.",
      });
    }

    const specialtyList = (
      Array.isArray(specialties) ? specialties : [specialties]
    )
      .map((s) => String(s).trim())
      .filter(Boolean);

    if (!specialtyList.length || specialtyList.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Invalid specialties.",
      });
    }

    const services = await Service.find({
      $or: specialtyList.map((s) => ({
        label: {
          $regex: `^${escapeRegex(s)}$`,
          $options: "i",
        },
      })),
    })
      .select("_id label")
      .lean();

    const serviceIds = services.map((s) => s._id);

    const assignments = serviceIds.length
      ? await TherapistAssignment.find({
          specialty: { $in: serviceIds },
        })
          .select("therapistId specialty")
          .lean()
      : [];

    const therapistIds = [
      ...new Set(assignments.map((a) => String(a.therapistId))),
    ];

    const therapists = therapistIds.length
      ? await User.find({
          _id: { $in: therapistIds },
          role: "Therapist",
          isActive: true,
        })
          .select("_id fullName")
          .lean()
      : [];

    const therapistMap = new Map(
      therapists.map((t) => [
        String(t._id),
        {
          therapistId: t._id,
          name: t.fullName,
        },
      ])
    );

    const serviceMap = new Map(
      services.map((s) => [s.label.toLowerCase(), s])
    );

    const result = specialtyList.map((specialtyName) => {
      const service = serviceMap.get(specialtyName.toLowerCase());

      if (!service) {
        return {
          specialtyId: null,
          specialty: specialtyName,
          doctors: [],
        };
      }

      const doctors = assignments
        .filter(
          (a) => String(a.specialty) === String(service._id)
        )
        .map((a) => therapistMap.get(String(a.therapistId)))
        .filter(Boolean);

      return {
        specialtyId: service._id,
        specialty: service.label,
        doctors: [
          ...new Map(
            doctors.map((doctor) => [
              String(doctor.therapistId),
              doctor,
            ])
          ).values(),
        ],
      };
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("getDoctorPublic:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch doctors.",
    });
  }
};

exports.getServicesPublic = async (req, res) => {
  try {
    const services = await Service.find().select("label").lean();

    return res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error("getServices:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch services.",
    });
  }
};