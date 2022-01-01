import { Skola24Child } from "@skolplattformen/api";

export const parseSchools = (absenceResponse: any): any[] => {
    return absenceResponse.data.schools.map((school: any) => {
        return {
            id: school.guid,
            name: school.name
        };
    });
}

export const parseChildren = (studentsResponse: any): Skola24Child[] => {
    return studentsResponse.data.students.map((student: any) => {
        return {
            personGuid: student.studentPersonGuid,
            firstName: student.studentName.substring(student.studentName.indexOf(', ') + 2),
            lastName: student.studentName.substring(0, student.studentName.indexOf(','))
        }
    });
}