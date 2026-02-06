document.querySelectorAll(".quarter, .hour-row-2").forEach((el) => {
    el.addEventListener("click", () => {
        const modal = new bootstrap.Modal(document.getElementById("timeModal"))
        document.getElementById("selectedTime").innerText =
            "Вы выбрали: " + el.textContent
        modal.show()
    })
})
