import { DateTime, FixedOffsetZone } from 'luxon'
import { Skola24Child, TimetableEntry } from "@skolplattformen/api";

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

export const parseTimetable = (timetableResponse: any, year: number, week: number): TimetableEntry[] => {
    return timetableResponse.data.lessonInfo ?
            timetableResponse.data.lessonInfo
            .map((lesson:any) => {
                return {
                    id: lesson.guidId,
                    teacher: lesson.texts[1],
                    location: lesson.texts[2],
                    timeStart: lesson.timeStart,
                    timeEnd: lesson.timeEnd,
                    dayOfWeek: lesson.dayOfWeekNumber,
                    name: lesson.texts[0],
                    dateStart: DateTime.fromObject({
                        weekYear: year,
                        weekNumber: week,
                        weekday: lesson.dayOfWeekNumber,
                    }).toISODate(),
                    dateEnd: DateTime.fromObject({
                        weekYear: year,
                        weekNumber: week,
                        weekday: lesson.dayOfWeekNumber,
                    }).toISODate(),
                }
            })
            .sort((a: TimetableEntry, b: TimetableEntry) => {
                if(a.dayOfWeek === b.dayOfWeek) {
                    return a.timeStart < b.timeStart ? -1 : 1;
                } else {
                    return a.dayOfWeek < b.dayOfWeek ? -1 : 1;
                }
            })
        : [];
}